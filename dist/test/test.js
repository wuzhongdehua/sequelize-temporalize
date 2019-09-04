"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const sequelize_1 = require("sequelize");
const chai = __importStar(require("chai"));
const chai_as_promised_1 = __importDefault(require("chai-as-promised"));
const fs = __importStar(require("fs"));
chai.use(chai_as_promised_1.default);
const assert = chai.assert;
describe('Test sequelize-temporalize', function () {
    let sequelize;
    function newDB(paranoid, options) {
        if (sequelize) {
            sequelize.close();
            sequelize = null;
        }
        const dbFile = __dirname + '/.test.sqlite';
        try {
            fs.unlinkSync(dbFile);
        }
        catch (_a) { }
        sequelize = new sequelize_1.Sequelize('', '', '', {
            dialect: 'sqlite',
            storage: dbFile,
            logging: false //console.log
        });
        //Define origin models
        const User = sequelize.define('User', { name: sequelize_1.DataTypes.TEXT }, { paranoid: paranoid || false });
        const Creation = sequelize.define('Creation', {
            name: sequelize_1.DataTypes.TEXT,
            user: sequelize_1.DataTypes.INTEGER,
            user2: sequelize_1.DataTypes.INTEGER
        }, { paranoid: paranoid || false });
        const Tag = sequelize.define('Tag', { name: sequelize_1.DataTypes.TEXT }, { paranoid: paranoid || false });
        const Event = sequelize.define('Event', {
            name: sequelize_1.DataTypes.TEXT,
            creation: sequelize_1.DataTypes.INTEGER
        }, { paranoid: paranoid || false });
        const CreationTag = sequelize.define('CreationTag', {
            creation: sequelize_1.DataTypes.INTEGER,
            tag: sequelize_1.DataTypes.INTEGER
        }, { paranoid: paranoid || false });
        //Associate models
        //1.* with 2 association to same table
        User.hasMany(Creation, {
            foreignKey: 'user',
            as: 'creatorCreations'
        });
        User.hasMany(Creation, {
            foreignKey: 'user2',
            as: 'updatorCreations'
        });
        Creation.belongsTo(User, {
            foreignKey: 'user',
            as: 'createUser'
        });
        Creation.belongsTo(User, {
            foreignKey: 'user2',
            as: 'updateUser'
        });
        //1.1
        Event.belongsTo(Creation, {
            foreignKey: 'creation'
        });
        Creation.hasOne(Event, {
            foreignKey: 'creation'
        });
        //*.*
        Tag.belongsToMany(Creation, {
            through: CreationTag,
            foreignKey: 'tag',
            otherKey: 'creation'
        });
        Creation.belongsToMany(Tag, {
            through: CreationTag,
            foreignKey: 'creation',
            otherKey: 'tag'
        });
        // Temporalize
        index_1.Temporalize({
            model: User,
            sequelize,
            temporalizeOptions: options
        });
        index_1.Temporalize({
            model: Creation,
            sequelize,
            temporalizeOptions: options
        });
        index_1.Temporalize({
            model: Tag,
            sequelize,
            temporalizeOptions: options
        });
        index_1.Temporalize({
            model: Event,
            sequelize,
            temporalizeOptions: options
        });
        index_1.Temporalize({
            model: CreationTag,
            sequelize,
            temporalizeOptions: options
        });
        return sequelize.sync({ force: true });
    }
    //Adding 3 tags, 2 creations, 2 events, 2 user
    //each creation has 3 tags
    //user has 2 creations
    //creation has 1 event
    //tags,creations,user,events are renamed 3 times to generate 3 history data
    //1 tag is removed and re-added to a creation to create 1 history entry in the CreationTags table
    function dataCreate() {
        const tag = sequelize.models.Tag.create({ name: 'tag01' }).then(t => {
            t.name = 'tag01 renamed';
            t.save();
            t.name = 'tag01 renamed twice';
            t.save();
            t.name = 'tag01 renamed three times';
            t.save();
            return t;
        });
        const tag2 = sequelize.models.Tag.create({ name: 'tag02' }).then(t => {
            t.name = 'tag02 renamed';
            t.save();
            t.name = 'tag02 renamed twice';
            t.save();
            t.name = 'tag02 renamed three times';
            t.save();
            return t;
        });
        const tag3 = sequelize.models.Tag.create({ name: 'tag03' }).then(t => {
            t.name = 'tag03 renamed';
            t.save();
            t.name = 'tag03 renamed twice';
            t.save();
            t.name = 'tag03 renamed three times';
            t.save();
            return t;
        });
        const user = sequelize.models.User.create({ name: 'user01' }).then(u => {
            u.name = 'user01 renamed';
            u.save();
            u.name = 'user01 renamed twice';
            u.save();
            u.name = 'user01 renamed three times';
            u.save();
            return u;
        });
        const user2 = sequelize.models.User.create({ name: 'user02' }).then(u => {
            u.name = 'user02 renamed';
            u.save();
            u.name = 'user02 renamed twice';
            u.save();
            u.name = 'user02 renamed three times';
            u.save();
            return u;
        });
        const creation = Promise.all([user, user2])
            .then(allU => sequelize.models.Creation.create({
            name: 'creation01',
            user: allU[0].id,
            user2: allU[1].id
        }))
            .then(c => {
            c.name = 'creation01 renamed';
            c.save();
            c.name = 'creation01 renamed twice';
            c.save();
            c.name = 'creation01 renamed three times';
            c.save();
            return c;
        });
        const creation2 = Promise.all([user, user2])
            .then(allU => sequelize.models.Creation.create({
            name: 'creation02',
            user: allU[0].id,
            user2: allU[1].id
        }))
            .then(c => {
            c.name = 'creation02 renamed';
            c.save();
            c.name = 'creation02 renamed twice';
            c.save();
            c.name = 'creation02 renamed three times';
            c.save();
            return c;
        });
        const event = creation
            .then(c => sequelize.models.Event.create({
            name: 'event01',
            creation: c.id
        }))
            .then(e => {
            e.name = 'event01 renamed';
            e.save();
            e.name = 'event01 renamed twice';
            e.save();
            e.name = 'event01 renamed three times';
            e.save();
            return e;
        });
        const event2 = creation2
            .then(c => sequelize.models.Event.create({
            name: 'event02',
            creation: c.id
        }))
            .then(e => {
            e.name = 'event02 renamed';
            e.save();
            e.name = 'event02 renamed twice';
            e.save();
            e.name = 'event02 renamed three times';
            e.save();
            return e;
        });
        const creationTag1 = Promise.all([tag, creation]).then(models => {
            const t = models[0];
            const c = models[1];
            console.log('\n\n\nadd tag');
            console.log(t.dataValues);
            console.log(c.dataValues);
            return c.addTag(t);
        });
        const creationTag1_rem = Promise.all([tag, creation, creationTag1]).then(models => {
            const t = models[0];
            const c = models[1];
            console.log('\n\n\nremove tag');
            console.log(t.dataValues);
            console.log(c.dataValues);
            return c.removeTag(t);
        });
        const creationTag1_rea = Promise.all([
            tag,
            creation,
            creationTag1_rem
        ]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        const creationTag2 = Promise.all([tag2, creation]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        const creationTag3 = Promise.all([tag3, creation]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        const creationTag4 = Promise.all([tag, creation2]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        const creationTag5 = Promise.all([tag2, creation2]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        const creationTag6 = Promise.all([tag3, creation2]).then(models => {
            const t = models[0];
            const c = models[1];
            return c.addTag(t);
        });
        return Promise.all([
            event,
            event2,
            tag,
            tag2,
            tag3,
            user,
            user2,
            creation,
            creation2,
            creationTag1,
            creationTag2,
            creationTag3,
            creationTag4,
            creationTag5,
            creationTag6,
            creationTag1_rea,
            creationTag1_rem
        ]);
    }
    function freshDB() {
        return newDB();
    }
    function freshDBWithAssociations() {
        return newDB(false, {
            addAssociations: true
        });
    }
    function freshDBWithSuffixEndingWithT() {
        return newDB(false, {
            modelSuffix: '_Hist'
        });
    }
    function assertCount(modelHistory, n, options) {
        // wrapped, chainable promise
        return function (obj) {
            return modelHistory.count(options).then(count => {
                console.log('Count: ' + count);
                assert.equal(count, n, 'history entries ' + modelHistory.name);
                return obj;
            });
        };
    }
    test();
    function test() {
        describe('DB Tests', function () {
            beforeEach(freshDB);
            it('onUpdate/onDestroy: should save to the historyDB 1', function () {
                return sequelize.models.User.create()
                    .then(assertCount(sequelize.models.UserHistory, 1))
                    .then(user => {
                    user.name = 'foo';
                    return user.save();
                })
                    .then(assertCount(sequelize.models.UserHistory, 2))
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.UserHistory, 3));
            });
            it('revert on failed transactions', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.create({ name: 'not foo' })
                        .then(assertCount(sequelize.models.UserHistory, 1))
                        .then(user => {
                        user.name = 'foo';
                        return user.save(options);
                    })
                        .then(assertCount(sequelize.models.UserHistory, 2, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 1));
            });
            it('should archive every entry', function () {
                return sequelize.models.User.bulkCreate([
                    { name: 'foo1' },
                    { name: 'foo2' }
                ])
                    .then(assertCount(sequelize.models.UserHistory, 2))
                    .then(() => sequelize.models.User.update({ name: 'updated-foo' }, { where: {}, individualHooks: true }))
                    .then(assertCount(sequelize.models.UserHistory, 4));
            });
            it('should revert under transactions', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], options)
                        .then(assertCount(sequelize.models.UserHistory, 0))
                        .then(assertCount(sequelize.models.UserHistory, 2, options))
                        .then(() => sequelize.models.User.update({ name: 'updated-foo' }, {
                        where: {},
                        transaction
                    }))
                        .then(assertCount(sequelize.models.UserHistory, 0))
                        .then(assertCount(sequelize.models.UserHistory, 4, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 0));
            });
            it('should revert on failed transactions, even when using after hooks', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.create({ name: 'test' }, options)
                        .then(assertCount(sequelize.models.UserHistory, 1, options))
                        .then(user => user.destroy(options))
                        .then(assertCount(sequelize.models.UserHistory, 2, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 0));
            });
        });
        describe('Association Tests', function () {
            describe('test there are no history association', function () {
                beforeEach(freshDB);
                it('Should have relations for origin models but not for history models', function () {
                    const init = dataCreate();
                    //Get User
                    const user = init.then(() => sequelize.models.User.findOne());
                    //User associations check
                    const userHistory = user.then(u => {
                        assert.notExists(u.getUserHistories, 'User: getUserHistories exists');
                        return Promise.resolve('done');
                    });
                    const creation = user.then(u => {
                        assert.exists(u.getCreatorCreations, 'User: getCreatorCreations does not exist');
                        assert.exists(u.getUpdatorCreations, 'User: getUpdatorCreations does not exist');
                        return u.getCreatorCreations();
                    });
                    //Creation associations check
                    const creationHistory = creation.then(c => {
                        assert.equal(c.length, 2, 'User: should have found 2 creations');
                        const first = c[0];
                        assert.notExists(first.getCreationHistories, 'Creation: getCreationHistories exists');
                        return Promise.resolve('done');
                    });
                    const tag = creation.then(c => {
                        const first = c[0];
                        assert.exists(first.getTags, 'Creation: getTags does not exist');
                        return first.getTags();
                    });
                    const event = creation.then(c => {
                        const first = c[0];
                        assert.exists(first.getEvent, 'Creation: getEvent does not exist');
                        return first.getEvent();
                    });
                    const cUser = creation
                        .then(c => {
                        const first = c[0];
                        assert.exists(first.getCreateUser, 'Creation: getCreateUser does not exist');
                        assert.exists(first.getUpdateUser, 'Creation: getUpdateUser does not exist');
                        return first.getCreateUser();
                    })
                        .then(cu => {
                        assert.exists(cu, 'Creation: did not find CreateUser');
                        return Promise.resolve('done');
                    });
                    //Tag associations check
                    const tagHistory = tag.then(t => {
                        assert.equal(t.length, 3, 'Creation: should have found 3 tags');
                        const first = t[0];
                        assert.notExists(first.getTagHistories, 'Tag: getTagHistories exists');
                        return Promise.resolve('done');
                    });
                    const tCreation = tag
                        .then(t => {
                        const first = t[0];
                        assert.exists(first.getCreations, 'Tag: getCreations does not exist');
                        return first.getCreations();
                    })
                        .then(tc => {
                        assert.equal(tc.length, 2, 'Tag: should have found 2 creations');
                        return Promise.resolve('done');
                    });
                    //Event associations check
                    const eventHistory = event.then(e => {
                        assert.exists(e, 'Creation: did not find event');
                        assert.notExists(e.getEventHistories, 'Event: getEventHistories exist');
                        return Promise.resolve('done');
                    });
                    const eCreation = event
                        .then(e => {
                        assert.exists(e.getCreation);
                        return e.getCreation();
                    })
                        .then(ec => {
                        assert.exists(ec);
                        return Promise.resolve('done');
                    });
                    //Check history data
                    const userHistories = init.then(assertCount(sequelize.models.UserHistory, 8));
                    const creationHistories = init.then(assertCount(sequelize.models.CreationHistory, 8));
                    const tagHistories = init.then(assertCount(sequelize.models.TagHistory, 12));
                    const eventHistories = init.then(assertCount(sequelize.models.EventHistory, 8));
                    const creationTagHistories = init.then(assertCount(sequelize.models.CreationTagHistory, 8));
                    return Promise.all([
                        creation,
                        creationHistories,
                        creationHistory,
                        creationTagHistories,
                        cUser,
                        eCreation,
                        event,
                        eventHistories,
                        eventHistory,
                        init,
                        tag,
                        tagHistories,
                        tagHistory,
                        tCreation,
                        user,
                        userHistories,
                        userHistory
                    ]).catch(err => {
                        console.log(err);
                        throw err;
                    });
                });
            });
            describe('test there are associations are created between origin and history', function () {
                beforeEach(freshDBWithAssociations);
                it('Should have relations for origin models and for history models to origin', function () {
                    const init = dataCreate();
                    //Get User
                    const user = init.then(() => sequelize.models.User.findOne());
                    //User associations check
                    const userHistory = user.then(u => {
                        assert.exists(u.getUserHistories, 'User: getUserHistories does not exist');
                        return u.getUserHistories();
                    });
                    const creation = user.then(u => {
                        assert.exists(u.getCreatorCreations, 'User: getCreatorCreations does not exist');
                        assert.exists(u.getUpdatorCreations, 'User: getUpdatorCreations does not exist');
                        return u.getCreatorCreations();
                    });
                    //UserHistories associations check
                    const uhCreation = userHistory
                        .then(uh => {
                        assert.equal(uh.length, 3, 'User: should have found 3 UserHistories');
                        const first = uh[0];
                        assert.exists(first.getCreatorCreations, 'UserHistory: getCreatorCreations does not exist');
                        assert.exists(first.getUpdatorCreations, 'UserHistory: getUpdatorCreations does not exist');
                        return first.getCreatorCreations();
                    })
                        .then(uhc => {
                        assert.equal(uhc.length, 2, 'UserHistory: should have found 2 creations');
                        return Promise.resolve('done');
                    });
                    const uhUser = userHistory
                        .then(uh => {
                        const first = uh[0];
                        assert.exists(first.getUser, 'UserHistory: getUser does not exist');
                        return first.getUser();
                    })
                        .then(uhu => {
                        assert.exists(uhu, 'UserHistory: did not find a user');
                        return Promise.resolve('done');
                    });
                    //Creation associations check
                    const creationHistory = creation.then(c => {
                        assert.equal(c.length, 2, 'User: should have found 2 creations');
                        const first = c[0];
                        assert.exists(first.getCreationHistories, 'Creation: getCreationHistories does not exist');
                        return first.getCreationHistories();
                    });
                    const tag = creation.then(c => {
                        const first = c[0];
                        assert.exists(first.getTags, 'Creation: getTags does not exist');
                        return first.getTags();
                    });
                    const event = creation.then(c => {
                        const first = c[0];
                        assert.exists(first.getEvent, 'Creation: getEvent does not exist');
                        return first.getEvent();
                    });
                    const cUser = creation
                        .then(c => {
                        const first = c[0];
                        assert.exists(first.getCreateUser, 'Creation: getCreateUser does not exist');
                        assert.exists(first.getUpdateUser, 'Creation: getUpdateUser does not exist');
                        return first.getCreateUser();
                    })
                        .then(cu => {
                        assert.exists(cu, 'Creation: did not find a create user');
                        return Promise.resolve('done');
                    });
                    //CreationHistories association check
                    const chCreation = creationHistory
                        .then(ch => {
                        assert.equal(ch.length, 3, 'Creation: should have found 3 CreationHistories');
                        const first = ch[0];
                        assert.exists(first.getCreation, 'CreationHistory: getCreation does not exist');
                        return first.getCreation();
                    })
                        .then(chc => {
                        assert.exists(chc, 'CreationHistory: did noy find a creation');
                        return Promise.resolve('done');
                    });
                    const chTag = creationHistory
                        .then(ch => {
                        const first = ch[0];
                        assert.exists(first.getTags, 'CreationHistory: getTags does not exist');
                        return first.getTags();
                    })
                        .then(uht => {
                        assert.equal(uht.length, 3);
                        return Promise.resolve('done');
                    });
                    const chUser = creationHistory
                        .then(ch => {
                        const first = ch[0];
                        assert.exists(first.getCreateUser, 'CreationHistory: getCreateUser does not exist');
                        assert.exists(first.getUpdateUser, 'CreationHistory: getUpdateUser does not exist');
                        return first.getCreateUser();
                    })
                        .then(chu => {
                        assert.exists(chu, 'CreationHistory: did not find a user');
                        return Promise.resolve('done');
                    });
                    const chEvent = creationHistory
                        .then(ch => {
                        const first = ch[0];
                        assert.exists(first.getEvent, 'CreationHistory: getEvent does not exist');
                        return first.getEvent();
                    })
                        .then(che => {
                        assert.exists(che, 'CreationHistory: did not find an event');
                        return Promise.resolve('done');
                    });
                    //Tag associations check
                    const tagHistory = tag.then(t => {
                        assert.equal(t.length, 3, 'Creation: should have found 3 tags');
                        const first = t[0];
                        assert.exists(first.getTagHistories, 'Tag: getTagHistories does not exist');
                        return first.getTagHistories();
                    });
                    const tCreation = tag
                        .then(t => {
                        const first = t[0];
                        assert.exists(first.getCreations, 'Tag: getCreations does not exist');
                        return first.getCreations();
                    })
                        .then(tc => {
                        assert.equal(tc.length, 2, 'Tag: should have found 2 creations');
                        return Promise.resolve('done');
                    });
                    //TagHistories associations check
                    const thTag = tagHistory
                        .then(th => {
                        assert.equal(th.length, 3, 'TagHistory: should have found 3 TagHistories');
                        const first = th[0];
                        assert.exists(first.getTag, 'TagHistory: getTag does not exist');
                        return first.getTag();
                    })
                        .then(tht => {
                        assert.exists(tht, 'TagHistory: did not find a tag');
                        return Promise.resolve('done');
                    });
                    const thCreation = tagHistory
                        .then(th => {
                        const first = th[0];
                        assert.exists(first.getCreations, 'TagHistory: getCreations does not exist');
                        return first.getCreations();
                    })
                        .then(thc => {
                        assert.equal(thc.length, 2, 'TagHistory: should have found 2 creations');
                        return Promise.resolve('done');
                    });
                    //Event associations check
                    const eventHistory = event.then(e => {
                        assert.exists(e, 'Creation: did not find an event');
                        assert.exists(e.getEventHistories, 'Event: getEventHistories does not exist');
                        return e.getEventHistories();
                    });
                    const eCreation = event
                        .then(e => {
                        assert.exists(e.getCreation, 'Event: getCreation does not exist');
                        return e.getCreation();
                    })
                        .then(ec => {
                        assert.exists(ec, 'Event: did not find a creation');
                        return Promise.resolve('done');
                    });
                    //EventHistories associations check
                    const ehEvent = eventHistory
                        .then(eh => {
                        assert.equal(eh.length, 3, 'Event: should have found 3 EventHistories');
                        const first = eh[0];
                        assert.exists(first.getEvent, 'EventHistories: getEvent does not exist');
                        return first.getEvent();
                    })
                        .then(ehe => {
                        assert.exists(ehe, 'EventHistories: did not find an event');
                        return Promise.resolve('done');
                    });
                    const ehCreation = eventHistory
                        .then(eh => {
                        const first = eh[0];
                        assert.exists(first.getCreation, 'EventHistories: getCreation does not exist');
                        return first.getCreation();
                    })
                        .then(ehc => {
                        assert.exists(ehc, 'EventHistories: did not find a creation');
                        return Promise.resolve('done');
                    });
                    //Check history data
                    const userHistories = init.then(assertCount(sequelize.models.UserHistory, 6));
                    const creationHistories = init.then(assertCount(sequelize.models.CreationHistory, 6));
                    const tagHistories = init.then(assertCount(sequelize.models.TagHistory, 9));
                    const eventHistories = init.then(assertCount(sequelize.models.EventHistory, 6));
                    const creationTagHistories = init.then(assertCount(sequelize.models.CreationTagHistory, 1));
                    return Promise.all([
                        chCreation,
                        chEvent,
                        chTag,
                        chUser,
                        creation,
                        creationHistories,
                        creationHistory,
                        creationTagHistories,
                        cUser,
                        eCreation,
                        event,
                        eventHistories,
                        eventHistory,
                        init,
                        tag,
                        tagHistories,
                        tagHistory,
                        tCreation,
                        thCreation,
                        thTag,
                        uhCreation,
                        uhUser,
                        user,
                        userHistories,
                        userHistory,
                        ehEvent,
                        ehCreation
                    ]);
                });
            });
        });
        //these tests are the same as hooks since the results should not change, even with a different model name
        //Only added is to test for the model name
        describe('test suffix ending in T', function () {
            beforeEach(freshDBWithSuffixEndingWithT);
            it('onCreate: should not store the new version in history db', function () {
                return sequelize.models.User.create({ name: 'test' }).then(assertCount(sequelize.models.User_Hist, 0));
            });
            it('onUpdate/onDestroy: should save to the historyDB', function () {
                return sequelize.models.User.create()
                    .then(assertCount(sequelize.models.User_Hist, 0))
                    .then(user => {
                    user.name = 'foo';
                    return user.save();
                })
                    .then(assertCount(sequelize.models.User_Hist, 1))
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.User_Hist, 2));
            });
            it('onUpdate: should store the previous version to the historyDB', function () {
                return sequelize.models.User.create({ name: 'foo' })
                    .then(assertCount(sequelize.models.User_Hist, 0))
                    .then(user => {
                    user.name = 'bar';
                    return user.save();
                })
                    .then(assertCount(sequelize.models.User_Hist, 1))
                    .then(() => sequelize.models.User_Hist.findAll())
                    .then(users => {
                    assert.equal(users.length, 1, 'only one entry in DB');
                    assert.equal(users[0].name, 'foo', 'previous entry saved');
                })
                    .then(() => sequelize.models.User.findOne())
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.User_Hist, 2));
            });
            it('onDelete: should store the previous version to the historyDB', function () {
                return sequelize.models.User.create({ name: 'foo' })
                    .then(assertCount(sequelize.models.User_Hist, 0))
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.User_Hist, 1))
                    .then(() => sequelize.models.User_Hist.findAll())
                    .then(users => {
                    assert.equal(users.length, 1, 'only one entry in DB');
                    assert.equal(users[0].name, 'foo', 'previous entry saved');
                });
            });
        });
        describe('hooks', function () {
            beforeEach(freshDB);
            it('onCreate: should not store the new version in history db', function () {
                return sequelize.models.User.create({ name: 'test' }).then(assertCount(sequelize.models.UserHistory, 0));
            });
            it('onUpdate/onDestroy: should save to the historyDB', function () {
                return sequelize.models.User.create()
                    .then(assertCount(sequelize.models.UserHistory, 0))
                    .then(user => {
                    user.name = 'foo';
                    return user.save();
                })
                    .then(assertCount(sequelize.models.UserHistory, 1))
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.UserHistory, 2));
            });
            it('onUpdate: should store the previous version to the historyDB', function () {
                return sequelize.models.User.create({ name: 'foo' })
                    .then(assertCount(sequelize.models.UserHistory, 0))
                    .then(user => {
                    user.name = 'bar';
                    return user.save();
                })
                    .then(assertCount(sequelize.models.UserHistory, 1))
                    .then(() => sequelize.models.UserHistory.findAll())
                    .then(users => {
                    assert.equal(users.length, 1, 'only one entry in DB');
                    assert.equal(users[0].name, 'foo', 'previous entry saved');
                })
                    .then(user => sequelize.models.User.findOne())
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.UserHistory, 2));
            });
            it('onDelete: should store the previous version to the historyDB', function () {
                return sequelize.models.User.create({ name: 'foo' })
                    .then(assertCount(sequelize.models.UserHistory, 0))
                    .then(user => user.destroy())
                    .then(assertCount(sequelize.models.UserHistory, 1))
                    .then(() => sequelize.models.UserHistory.findAll())
                    .then(users => {
                    assert.equal(users.length, 1, 'only one entry in DB');
                    assert.equal(users[0].name, 'foo', 'previous entry saved');
                });
            });
        });
        describe('transactions', function () {
            beforeEach(freshDB);
            it('revert on failed transactions', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.create({ name: 'not foo' }, options)
                        .then(assertCount(sequelize.models.UserHistory, 0, options))
                        .then(user => {
                        user.name = 'foo';
                        user.save(options);
                    })
                        .then(assertCount(sequelize.models.UserHistory, 1, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 0));
            });
        });
        describe('bulk update', function () {
            beforeEach(freshDB);
            it('should archive every entry', function () {
                return sequelize.models.User.bulkCreate([
                    { name: 'foo1' },
                    { name: 'foo2' }
                ])
                    .then(assertCount(sequelize.models.UserHistory, 0))
                    .then(() => sequelize.models.User.update({ name: 'updated-foo' }, { where: {} }))
                    .then(assertCount(sequelize.models.UserHistory, 2));
            });
            it('should revert under transactions', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], options)
                        .then(assertCount(sequelize.models.UserHistory, 0, options))
                        .then(() => sequelize.models.User.update({ name: 'updated-foo' }, {
                        where: {},
                        transaction
                    }))
                        .then(assertCount(sequelize.models.UserHistory, 2, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 0));
            });
        });
        describe('bulk destroy/truncate', function () {
            beforeEach(freshDB);
            it('should archive every entry', function () {
                return sequelize.models.User.bulkCreate([
                    { name: 'foo1' },
                    { name: 'foo2' }
                ])
                    .then(assertCount(sequelize.models.UserHistory, 0))
                    .then(() => sequelize.models.User.destroy({
                    where: {},
                    truncate: true // truncate the entire table
                }))
                    .then(assertCount(sequelize.models.UserHistory, 2));
            });
            it('should revert under transactions', function () {
                return sequelize
                    .transaction()
                    .then(transaction => {
                    const options = { transaction };
                    return sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], options)
                        .then(assertCount(sequelize.models.UserHistory, 0, options))
                        .then(() => sequelize.models.User.destroy({
                        where: {},
                        truncate: true,
                        transaction
                    }))
                        .then(assertCount(sequelize.models.UserHistory, 2, options))
                        .then(() => transaction.rollback());
                })
                    .then(assertCount(sequelize.models.UserHistory, 0));
            });
        });
        describe('bulk destroy/truncate with associations', function () {
            beforeEach(freshDBWithAssociations);
            it('should archive every entry', function () {
                return dataCreate()
                    .then(assertCount(sequelize.models.UserHistory, 3))
                    .then(() => sequelize.models.User.destroy({
                    where: {},
                    truncate: true // truncate the entire table
                }))
                    .then(assertCount(sequelize.models.UserHistory, 6))
                    .then(() => sequelize.models.User.findOne())
                    .then(u => u.getUserHistories())
                    .then(uh => assert.exists(uh, 'The truncation did not break the associations'))
                    .catch(err => assert.exists(err, 'The truncation broke the associations'));
            });
            it('should fail to truncate', function () {
                return dataCreate()
                    .then(() => sequelize.transaction())
                    .then(transaction => {
                    const options = { transaction };
                    assertCount(sequelize.models.UserHistory, 6, options);
                    return sequelize.models.User.destroy({
                        where: {},
                        truncate: true,
                        transaction
                    })
                        .then(assertCount(sequelize.models.UserHistory, 3, options))
                        .then(() => transaction.rollback())
                        .catch(err => assert.exists(err));
                })
                    .then(assertCount(sequelize.models.UserHistory, 6));
            });
        });
        describe('read-only ', function () {
            beforeEach(freshDB);
            it('should forbid updates', function () {
                const userUpdate = sequelize.models.UserHistory.create({
                    name: 'bla00'
                }).then(uh => uh.update({ name: 'bla' }));
                // @ts-ignore
                return assert.isRejected(userUpdate, Error, 'Validation error');
            });
            it('should forbid deletes', function () {
                const userUpdate = sequelize.models.UserHistory.create({
                    name: 'bla00'
                }).then(uh => uh.destroy());
                // @ts-ignore
                return assert.isRejected(userUpdate, Error, 'Validation error');
            });
        });
        describe('interference with the original model', function () {
            beforeEach(freshDB);
            it("shouldn't delete instance methods", function () {
                const Fruit = index_1.Temporalize({
                    model: sequelize.define('Fruit', {
                        name: sequelize_1.DataTypes.TEXT
                    }),
                    sequelize,
                    temporalizeOptions: {}
                });
                Fruit.prototype.sayHi = () => {
                    return 2;
                };
                return sequelize
                    .sync()
                    .then(() => Fruit.create())
                    .then(f => {
                    assert.isFunction(f.sayHi);
                    assert.equal(f.sayHi(), 2);
                });
            });
            it("shouldn't interfere with hooks of the model", function () {
                let triggered = 0;
                const Fruit = index_1.Temporalize({
                    model: sequelize.define('Fruit', { name: sequelize_1.DataTypes.TEXT }, {
                        hooks: {
                            beforeCreate: function () {
                                triggered++;
                            }
                        }
                    }),
                    sequelize,
                    temporalizeOptions: {}
                });
                return sequelize
                    .sync()
                    .then(() => Fruit.create())
                    .then(f => assert.equal(triggered, 1, 'hook trigger count'));
            });
            it("shouldn't interfere with setters", function () {
                let triggered = 0;
                const Fruit = index_1.Temporalize({
                    model: sequelize.define('Fruit', {
                        name: {
                            type: sequelize_1.DataTypes.TEXT,
                            set: function () {
                                triggered++;
                            }
                        }
                    }),
                    sequelize,
                    temporalizeOptions: {}
                });
                return sequelize
                    .sync()
                    .then(() => Fruit.create({ name: 'apple' }))
                    .then(f => assert.equal(triggered, 1, 'hook trigger count'));
            });
        });
    }
});
