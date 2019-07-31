"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const temporalDefaultOptions = {
    // runs the insert within the sequelize hook chain, disable
    // for increased performance
    blocking: true,
    // full: false,
    modelSuffix: 'History',
    indexSuffix: '_history',
    addAssociations: false,
    allowTransactions: true,
    logTransactionId: true
};
function Temporalize(model, sequelize, temporalOptions) {
    temporalOptions = lodash_1.default.extend({}, temporalDefaultOptions, temporalOptions);
    if (temporalOptions.logTransactionId && !temporalOptions.allowTransactions) {
        throw new Error('If temporalOptions.logTransactionId===true, temporalOptions.allowTransactions must also be true');
    }
    const Sequelize = sequelize.Sequelize;
    const historyName = model.name + temporalOptions.modelSuffix;
    const transactionIdAttr = temporalOptions.logTransactionId
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
        transactionId: transactionIdAttr
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
    const historyAttributes = lodash_1.default(model.rawAttributes)
        .mapValues(function (v) {
        v = lodash_1.default.omit(v, excludedAttributes);
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
    const modelOptions = lodash_1.default.omit(model.options, excludedNames);
    const historyOptions = lodash_1.default.assign({}, modelOptions, historyOwnOptions);
    // We want to delete indexes that have unique constraint
    const indexes = lodash_1.default.cloneDeep(historyOptions.indexes);
    if (Array.isArray(indexes)) {
        historyOptions.indexes = indexes.filter(function (index) {
            return !index.unique && index.type != 'UNIQUE';
        });
    }
    historyOptions.indexes.forEach(indexElement => {
        indexElement.name += temporalOptions.indexSuffix;
    });
    const modelHistory = sequelize.define(historyName, historyAttributes, historyOptions);
    modelHistory.originModel = model;
    modelHistory.addAssociations = temporalOptions.addAssociations;
    // we already get the updatedAt timestamp from our models
    const insertHook = function (obj, options) {
        return model
            .findOne({
            where: { id: obj.id },
            transaction: options.transaction,
            paranoid: false
        })
            .then(function (hit) {
            const dataValues = lodash_1.default.cloneDeep(hit.dataValues);
            dataValues.archivedAt = hit.dataValues.updatedAt;
            if (options.restoreOperation) {
                dataValues.archivedAt = Date.now(); // There may be a better time to use, but we are yet to find it
            }
            if (options.destroyOperation) {
                // If paranoid is true, use the deleted value
                dataValues.archivedAt = hit.dataValues.deletedAt || Date.now();
            }
            if (temporalOptions.logTransactionId && options.transaction) {
                dataValues.transactionId = getTransactionId(options.transaction);
            }
            const historyRecord = modelHistory.create(dataValues, {
                transaction: temporalOptions.allowTransactions
                    ? options.transaction
                    : null
            });
            if (temporalOptions.blocking) {
                return historyRecord;
            }
        });
    };
    const insertBulkHook = function (options) {
        if (!options.individualHooks) {
            const queryAll = model
                .findAll({
                where: options.where,
                transaction: options.transaction,
                paranoid: false
            })
                .then(function (hits) {
                if (hits) {
                    hits = lodash_1.default.map(hits, 'dataValues');
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
                    if (temporalOptions.logTransactionId && options.transaction) {
                        hits.forEach(ele => {
                            ele.transactionId = getTransactionId(options.transaction);
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
    const beforeSync = function () {
        const source = this.originModel;
        const sourceHist = this;
        if (source &&
            !source.name.endsWith(temporalOptions.modelSuffix) &&
            source.associations &&
            temporalOptions.addAssociations == true &&
            sourceHist) {
            const pkfield = source.primaryKeyField;
            //adding associations from history model to origin model's association
            Object.keys(source.associations).forEach(assokey => {
                const association = source.associations[assokey];
                const associationOptions = lodash_1.default.cloneDeep(association.options);
                const target = association.target;
                const assocName = association.associationType.charAt(0).toLowerCase() +
                    association.associationType.substr(1);
                associationOptions.onDelete = 'NO ACTION';
                associationOptions.onUpdate = 'NO ACTION';
                //handle primary keys for belongsToMany
                if (assocName == 'belongsToMany') {
                    sourceHist.primaryKeys = lodash_1.default.forEach(source.primaryKeys, x => (x.autoIncrement = false));
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
    const readOnlyHook = function () {
        throw new Error("This is a read-only history database. You aren't allowed to modify it.");
    };
    modelHistory.addHook('beforeUpdate', readOnlyHook);
    modelHistory.addHook('beforeDestroy', readOnlyHook);
    modelHistory.addHook('beforeSync', 'HistoricalSyncHook', beforeSync);
    return model;
}
exports.Temporalize = Temporalize;
function getTransactionId(transaction) {
    function getId() {
        return this.id;
    }
    const boundGetId = getId.bind(transaction);
    return boundGetId();
}
exports.getTransactionId = getTransactionId;
