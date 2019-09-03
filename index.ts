import _ from 'lodash';

const temporalizeDefaultOptions = {
  // runs the insert within the sequelize hook chain, disable
  // for increased performance
  blocking: true,
  modelSuffix: 'History',
  indexSuffix: '_history',
  addAssociations: false,
  allowTransactions: true,
  logTransactionId: true,
  logEventId: true,
  eventIdColumnName: 'eventId'
};

export function Temporalize({
  model,
  modelHistory,
  sequelize,
  temporalizeOptions
}: {
  model;
  modelHistory?;
  sequelize;
  temporalizeOptions;
}) {
  temporalizeOptions = _.extend(
    {},
    temporalizeDefaultOptions,
    temporalizeOptions
  );

  if (
    temporalizeOptions.logTransactionId &&
    !temporalizeOptions.allowTransactions
  ) {
    throw new Error(
      'If temporalizeOptions.logTransactionId===true, temporalizeOptions.allowTransactions must also be true'
    );
  }

  const Sequelize = sequelize.Sequelize;
  const Op = Sequelize.Op;

  const historyName = model.name + temporalizeOptions.modelSuffix;

  const transactionIdAttr = temporalizeOptions.logTransactionId
    ? {
        type: Sequelize.DataTypes.UUID,
        allowNull: true
      }
    : undefined;

  const eventIdAttr = temporalizeOptions.logEventId
    ? {
        type: Sequelize.DataTypes.UUID,
        allowNull: true
      }
    : undefined;

  const historyOwnAttrs = {
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
    },
    transactionId: transactionIdAttr,
    [temporalizeOptions.eventIdColumnName]: eventIdAttr
  };

  const excludedAttributes = [
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
  const historyAttributes = _(model.rawAttributes)
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

  const historyOwnOptions = {
    timestamps: false
  };
  const excludedNames = [
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
  const modelOptions = _.omit(model.options, excludedNames);
  const historyOptions: any = _.assign({}, modelOptions, historyOwnOptions);

  // We want to delete indexes that have unique constraint
  const indexes = _.cloneDeep(historyOptions.indexes);
  if (Array.isArray(indexes)) {
    historyOptions.indexes = indexes.filter(function(index) {
      return !index.unique && index.type != 'UNIQUE';
    });
  }
  historyOptions.indexes.forEach(indexElement => {
    if (
      indexElement.name.length + temporalizeOptions.indexSuffix.length >=
      63
    ) {
      console.log(
        'index name ' +
          indexElement.name +
          ' is very long and hence it was shortened before adding the suffix ' +
          temporalizeOptions.indexSuffix
      );
      indexElement.name =
        indexElement.name.substring(
          0,
          indexElement.name.length - temporalizeOptions.indexSuffix.length
        ) + temporalizeOptions.indexSuffix;
    } else {
      indexElement.name += temporalizeOptions.indexSuffix;
    }
  });

  let modelHistoryOutput;
  if (modelHistory) {
    const historyClassOptions = {
      ...historyOptions,
      sequelize,
      tableName: historyName
    };
    modelHistory.init(historyAttributes, historyClassOptions);
    modelHistoryOutput = modelHistory;
  } else {
    modelHistoryOutput = sequelize.define(
      historyName,
      historyAttributes,
      historyOptions
    );
  }
  modelHistoryOutput.originModel = model;
  modelHistoryOutput.addAssociations = temporalizeOptions.addAssociations; // TODO delete?

  function transformToHistoryEntry(
    instance,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
    const dataValues = _.cloneDeep(instance.dataValues);
    dataValues.archivedAt = instance.dataValues.updatedAt;
    if (restoreOperation) {
      dataValues.archivedAt = Date.now(); // There may be a better time to use, but we are yet to find it
    }
    if (destroyOperation) {
      // If paranoid is true, use the deleted value
      dataValues.archivedAt = instance.dataValues.deletedAt || Date.now();
    }
    if (temporalizeOptions.logTransactionId && options.transaction) {
      dataValues.transactionId = getTransactionId(options.transaction);
    }
    if (temporalizeOptions.logEventId && options.eventId) {
      dataValues[temporalizeOptions.eventIdColumnName] = options.eventId;
    }
    return dataValues;
  }

  async function createHistoryEntry(
    instance,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
    const dataValues = transformToHistoryEntry(instance, options, {
      destroyOperation,
      restoreOperation
    });
    const historyRecord = modelHistoryOutput.create(dataValues, {
      transaction: temporalizeOptions.allowTransactions
        ? options.transaction
        : null
    });
    if (temporalizeOptions.blocking) {
      return historyRecord;
    }
  }

  async function createHistoryEntryBulk(
    instances,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
    const dataValuesArr = instances.map(instance => {
      return transformToHistoryEntry(instance, options, {
        destroyOperation,
        restoreOperation
      });
    });
    const historyRecord = modelHistoryOutput.bulkCreate(dataValuesArr, {
      transaction: temporalizeOptions.allowTransactions
        ? options.transaction
        : null
    });
    if (temporalizeOptions.blocking) {
      return historyRecord;
    }
  }

  const afterCreateHook = async function(obj, options) {
    return model
      .findOne({
        where: { id: obj.id },
        transaction: options.transaction,
        paranoid: false
      })
      .then(function(instance) {
        return createHistoryEntry(instance, options, {});
      });
  };

  const afterBulkCreateHook = async function(instances, options) {
    if (!options.individualHooks) {
      return createHistoryEntryBulk(instances, options, {});
    }
  };

  const afterUpdateHook = async (instance, options) => {
    return createHistoryEntry(instance, options, {});
  };

  const beforeBulkUpdateHook = async options => {
    if (!options.individualHooks) {
      const instances = await model.findAll({
        attributes: model.primaryKeyAttributes,
        where: options.where,
        transaction: options.transaction,
        paranoid: options.paranoid
      });
      options._sequelizeTemporalizeIdStore = instances.map(
        i => i[model.primaryKeyAttributes[0]]
      );
    }
  };

  const afterBulkUpdateHook = async options => {
    if (!options.individualHooks) {
      const primaryKeyValues = options._sequelizeTemporalizeIdStore;
      const instances = await model.findAll({
        where: {
          [model.primaryKeyAttributes[0]]: { [Op.in]: primaryKeyValues }
        },
        transaction: options.transaction,
        paranoid: options.paranoid
      });
      return createHistoryEntryBulk(instances, options, {
        destroyOperation: true
      });
    }
  };

  const afterDestroyHook = async (instance, options) => {
    return createHistoryEntry(instance, options, { destroyOperation: true });
  };

  const afterBulkDestroyHook = async options => {
    if (!options.individualHooks) {
      const instances = await model.findAll({
        where: options.where,
        transaction: options.transaction,
        paranoid: false
      });
      return createHistoryEntryBulk(instances, options, {
        destroyOperation: true
      });
    }
  };

  const afterRestoreHook = async (instance, options) => {
    return createHistoryEntry(instance, options, { restoreOperation: true });
  };

  const afterBulkRestoreHook = async options => {
    options.restoreOperation = true;
    if (!options.individualHooks) {
      await model
        .findAll({
          where: options.where,
          transaction: options.transaction,
          paranoid: false
        })
        .then(function(instances) {
          return createHistoryEntryBulk(instances, options, {
            restoreOperation: true
          });
        });
    }
  };

  model.addHook('afterCreate', afterCreateHook);
  model.addHook('afterBulkCreate', afterBulkCreateHook);
  model.addHook('afterUpdate', afterUpdateHook);
  model.addHook('beforeBulkUpdate', beforeBulkUpdateHook);
  model.addHook('afterBulkUpdate', afterBulkUpdateHook);
  model.addHook('afterDestroy', afterDestroyHook);
  model.addHook('afterBulkDestroy', afterBulkDestroyHook);
  model.addHook('afterRestore', afterRestoreHook);
  model.addHook('afterBulkRestore', afterBulkRestoreHook);

  const readOnlyHook = function() {
    throw new Error(
      "This is a read-only history database. You aren't allowed to modify it."
    );
  };

  modelHistoryOutput.addHook('beforeUpdate', readOnlyHook);
  modelHistoryOutput.addHook('beforeDestroy', readOnlyHook);

  const beforeSync = function() {
    const source = this.originModel;
    const sourceHist = this;

    if (
      source &&
      !source.name.endsWith(temporalizeOptions.modelSuffix) &&
      source.associations &&
      temporalizeOptions.addAssociations == true &&
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

    return Promise.resolve('Temporalize associations established');
  };

  modelHistoryOutput.addHook('beforeSync', 'HistoricalSyncHook', beforeSync);

  return modelHistoryOutput;
}

export function getTransactionId(transaction) {
  function getId() {
    return this.id;
  }
  const boundGetId = getId.bind(transaction);
  return boundGetId();
}
