var _ = require('lodash');

var temporalDefaultOptions = {
  // runs the insert within the sequelize hook chain, disable
  // for increased performance
  blocking: true,
  // full: false,
  modelSuffix: 'History',
  indexSuffix: '_history',
  addAssociations: false,
  allowTransactions: true
};

var Temporal = function(model, sequelize, temporalOptions) {
  temporalOptions = _.extend({}, temporalDefaultOptions, temporalOptions);

  var Sequelize = sequelize.Sequelize;

  var historyName = model.name + temporalOptions.modelSuffix;

  var historyOwnAttrs = {
    hid: {
      type: Sequelize.DataTypes.UUID,
      defaultValue: Sequelize.DataTypes.UUIDV4,
      primaryKey: true,
      // autoIncrement: true,
      unique: true
    },
    archivedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
  };

  var excludedAttributes = [
    'Model',
    'unique',
    'primaryKey',
    'autoIncrement',
    'set',
    'get',
    '_modelAttribute',
    'references',
    'onDelete',
    'onUpdate'
  ];
  var historyAttributes = _(model.rawAttributes)
    .mapValues(function(v) {
      v = _.omit(v, excludedAttributes);
      // remove the "NOW" defaultValue for the default timestamps
      // we want to save them, but just a copy from our master record
      if (v.fieldName == 'createdAt' || v.fieldName == 'updatedAt') {
        v.type = Sequelize.DATE;
      }
      return v;
    })
    .assign(historyOwnAttrs)
    .value();
  // If the order matters, use this:
  //historyAttributes = _.assign({}, historyOwnAttrs, historyAttributes);

  var historyOwnOptions = {
    timestamps: false
  };
  var excludedNames = [
    'name',
    'tableName',
    'sequelize',
    'uniqueKeys',
    'hasPrimaryKey',
    'hooks',
    'scopes',
    'instanceMethods',
    'defaultScope'
  ];
  var modelOptions = _.omit(model.options, excludedNames);
  var historyOptions = _.assign({}, modelOptions, historyOwnOptions);

  // We want to delete indexes that have unique constraint
  var indexes = _.cloneDeep(historyOptions.indexes);
  if (Array.isArray(indexes)) {
    historyOptions.indexes = indexes.filter(function(index) {
      return !index.unique && index.type != 'UNIQUE';
    });
  }
  historyOptions.indexes.forEach(indexElement => {
    indexElement.name += temporalOptions.indexSuffix;
  });

  var modelHistory = sequelize.define(
    historyName,
    historyAttributes,
    historyOptions
  );
  modelHistory.originModel = model;
  modelHistory.addAssociations = temporalOptions.addAssociations;

  // we already get the updatedAt timestamp from our models
  var insertHook = function(obj, options) {
    return model
      .findOne({
        where: options.where,
        transaction: options.transaction,
        paranoid: false
      })
      .then(function(hit) {
        var dataValues = _.cloneDeep(hit.dataValues);
        dataValues.archivedAt = hit.dataValues.updatedAt;
        if (options.restoreOperation) {
          dataValues.archivedAt = Date.now(); // There may be a better time to use, but we are yet to find it
        }
        if (options.destroyOperation) {
          // If paranoid is true, use the deleted value
          dataValues.archivedAt = hit.dataValues.deletedAt || Date.now();
        }
        var historyRecord = modelHistory.create(dataValues, {
          transaction: temporalOptions.allowTransactions
            ? options.transaction
            : null
        });
        if (temporalOptions.blocking) {
          return historyRecord;
        }
      });
  };

  var insertBulkHook = function(options) {
    if (!options.individualHooks) {
      var queryAll = model
        .findAll({
          where: options.where,
          transaction: options.transaction,
          paranoid: false
        })
        .then(function(hits) {
          if (hits) {
            hits = _.map(hits, 'dataValues');
            hits.forEach(ele => {
              ele.archivedAt = ele.updatedAt;
            });
            if (options.restoreOperation) {
              hits.forEach(ele => {
                ele.archivedAt = Date.now();
              });
            }
            if (options.destroyOperation) {
              hits.forEach(ele => {
                // If paranoid is true, use the deleted value
                ele.archivedAt = ele.deletedAt || Date.now();
              });
            }
            return modelHistory.bulkCreate(hits, {
              transaction: temporalOptions.allowTransactions
                ? options.transaction
                : null
            });
          }
        });
      if (temporalOptions.blocking) {
        return queryAll;
      }
    }
  };

  var beforeSync = function() {
    const source = this.originModel;
    const sourceHist = this;

    if (
      source &&
      !source.name.endsWith(temporalOptions.modelSuffix) &&
      source.associations &&
      temporalOptions.addAssociations == true &&
      sourceHist
    ) {
      const pkfield = source.primaryKeyField;
      //adding associations from history model to origin model's association
      Object.keys(source.associations).forEach(assokey => {
        const association = source.associations[assokey];
        const associationOptions = _.cloneDeep(association.options);
        const target = association.target;
        const assocName =
          association.associationType.charAt(0).toLowerCase() +
          association.associationType.substr(1);
        associationOptions.onDelete = 'NO ACTION';
        associationOptions.onUpdate = 'NO ACTION';

        //handle primary keys for belongsToMany
        if (assocName == 'belongsToMany') {
          sourceHist.primaryKeys = _.forEach(
            source.primaryKeys,
            x => (x.autoIncrement = false)
          );
          sourceHist.primaryKeyField = Object.keys(sourceHist.primaryKeys)[0];
        }

        sourceHist[assocName].apply(sourceHist, [target, associationOptions]);
      });

      //adding associations between origin model and history
      source.hasMany(sourceHist, { foreignKey: pkfield });
      sourceHist.belongsTo(source, { foreignKey: pkfield });

      sequelize.models[sourceHist.name] = sourceHist;
    }

    return Promise.resolve('Temporal associations established');
  };

  const afterDestroyHook = (obj, options) => {
    options.destroyOperation = true;
    return insertHook(obj, options);
  };

  const afterBulkDestroyHook = options => {
    options.destroyOperation = true;
    return insertBulkHook(options);
  };

  const afterRestoreHook = (obj, options) => {
    options.restoreOperation = true;
    return insertHook(obj, options);
  };

  const afterBulkRestoreHook = options => {
    options.restoreOperation = true;
    return insertBulkHook(options);
  };

  model.addHook('afterCreate', insertHook);
  model.addHook('afterBulkCreate', insertBulkHook);
  model.addHook('afterUpdate', insertHook);
  model.addHook('afterBulkUpdate', insertBulkHook);
  model.addHook('afterDestroy', afterDestroyHook);
  model.addHook('afterBulkDestroy', afterBulkDestroyHook);
  model.addHook('afterRestore', afterRestoreHook);
  model.addHook('afterBulkRestore', afterBulkRestoreHook);

  var readOnlyHook = function() {
    throw new Error(
      "This is a read-only history database. You aren't allowed to modify it."
    );
  };

  modelHistory.addHook('beforeUpdate', readOnlyHook);
  modelHistory.addHook('beforeDestroy', readOnlyHook);
  modelHistory.addHook('beforeSync', 'HistoricalSyncHook', beforeSync);

  return model;
};

module.exports = Temporal;
