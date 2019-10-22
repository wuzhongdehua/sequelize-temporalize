import { Temporalize } from '../index';
import { Sequelize, DataTypes } from 'sequelize';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
chai.use(chaiAsPromised);
const assert = chai.assert;

// TODO: future tests
// Test paranoid: true and paranoid: false
// Test timestamps: true and timestamps: false
// Test logEventId and logTransactionId

describe('Test sequelize-temporalize', function() {
  let sequelize;

  function newDB({
    options,
    temporalizeOptions
  }: {
    options?: { paranoid?: boolean; timestamps?: boolean };
    temporalizeOptions?;
  } = {}) {
    // Set defaults
    options = options || {};
    options.paranoid = options.paranoid || false;

    if (sequelize) {
      sequelize.close();
      sequelize = null;
    }

    const dbFile = __dirname + '/.test.sqlite';

    try {
      fs.unlinkSync(dbFile);
    } catch {}

    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: dbFile,
      logging: false //console.log
    });

    // Define origin models
    const User = sequelize.define('User', { name: DataTypes.TEXT }, options);
    const Creation = sequelize.define(
      'Creation',
      {
        name: DataTypes.TEXT,
        user: DataTypes.INTEGER,
        user2: DataTypes.INTEGER
      },
      options
    );
    const Tag = sequelize.define('Tag', { name: DataTypes.TEXT }, options);
    const Event = sequelize.define(
      'Event',
      {
        name: DataTypes.TEXT,
        creation: DataTypes.INTEGER
      },
      options
    );
    const CreationTag = sequelize.define(
      'CreationTag',
      {
        creation: DataTypes.INTEGER,
        tag: DataTypes.INTEGER
      },
      options
    );

    //Associate models

    //1.* with 2 association to same table
    User.hasMany(Creation, {
      foreignKey: 'user',
      as: 'creatorCreations'
    });
    User.hasMany(Creation, {
      foreignKey: 'user2',
      as: 'updaterCreations'
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
    Temporalize({
      model: User,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Creation,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Tag,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Event,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: CreationTag,
      sequelize,
      temporalizeOptions
    });

    return sequelize.sync({ force: true });
  }

  // Adding 3 tags, 2 creations, 2 events, 2 user
  // each creation has 3 tags
  // user has 2 creations
  // creation has 1 event
  // tags,creations,user,events are renamed 3 times to generate 3 history data
  // 1 tag is removed and re-added to a creation to create 1 history entry in the CreationTags table
  async function dataCreate() {
    const tag1 = await sequelize.models.Tag.create({ name: 'tag01' }).then(
      t => {
        t.name = 'tag01 renamed';
        t.save();
        t.name = 'tag01 renamed twice';
        t.save();
        t.name = 'tag01 renamed three times';
        t.save();
        return t;
      }
    );

    const tag2 = await sequelize.models.Tag.create({ name: 'tag02' }).then(
      t => {
        t.name = 'tag02 renamed';
        t.save();
        t.name = 'tag02 renamed twice';
        t.save();
        t.name = 'tag02 renamed three times';
        t.save();
        return t;
      }
    );

    const tag3 = await sequelize.models.Tag.create({ name: 'tag03' }).then(
      t => {
        t.name = 'tag03 renamed';
        t.save();
        t.name = 'tag03 renamed twice';
        t.save();
        t.name = 'tag03 renamed three times';
        t.save();
        return t;
      }
    );

    const user1 = await sequelize.models.User.create({ name: 'user01' }).then(
      u => {
        u.name = 'user01 renamed';
        u.save();
        u.name = 'user01 renamed twice';
        u.save();
        u.name = 'user01 renamed three times';
        u.save();
        return u;
      }
    );

    const user2 = await sequelize.models.User.create({ name: 'user02' }).then(
      u => {
        u.name = 'user02 renamed';
        u.save();
        u.name = 'user02 renamed twice';
        u.save();
        u.name = 'user02 renamed three times';
        u.save();
        return u;
      }
    );

    const creation1 = await sequelize.models.Creation.create({
      name: 'creation01',
      user: user1.id,
      user2: user2.id
    }).then(c => {
      c.name = 'creation01 renamed';
      c.save();
      c.name = 'creation01 renamed twice';
      c.save();
      c.name = 'creation01 renamed three times';
      c.save();
      return c;
    });

    const creation2 = await sequelize.models.Creation.create({
      name: 'creation02',
      user: user1.id,
      user2: user2.id
    }).then(c => {
      c.name = 'creation02 renamed';
      c.save();
      c.name = 'creation02 renamed twice';
      c.save();
      c.name = 'creation02 renamed three times';
      c.save();
      return c;
    });

    const event1 = await sequelize.models.Event.create({
      name: 'event01',
      creation: creation1.id
    }).then(e => {
      e.name = 'event01 renamed';
      e.save();
      e.name = 'event01 renamed twice';
      e.save();
      e.name = 'event01 renamed three times';
      e.save();
      return e;
    });

    const event2 = await sequelize.models.Event.create({
      name: 'event02',
      creation: creation2.id
    }).then(e => {
      e.name = 'event02 renamed';
      e.save();
      e.name = 'event02 renamed twice';
      e.save();
      e.name = 'event02 renamed three times';
      e.save();
      return e;
    });

    const creationTag1 = await creation1.addTag(tag1);
    const creationTag1_rem = await creation1.removeTag(tag1);
    const creationTag1_rea = await creation1.addTag(tag1);
    const creationTag2 = await creation1.addTag(tag2);
    const creationTag3 = await creation1.addTag(tag3);
    const creationTag4 = await creation2.addTag(tag1);
    const creationTag5 = await creation2.addTag(tag2);
    const creationTag6 = await creation2.addTag(tag3);
  }

  function freshDB() {
    return newDB({ options: { paranoid: false, timestamps: false } });
  }

  function freshDBWithSuffixEndingWithT() {
    return newDB({
      options: { paranoid: false },
      temporalizeOptions: {
        modelSuffix: '_Hist'
      }
    });
  }

  function assertCount(modelHistory, n, options?) {
    // wrapped, chainable promise
    return function(obj) {
      return modelHistory.count(options).then(count => {
        assert.equal(count, n, 'history entries ' + modelHistory.name);
        return obj;
      });
    };
  }

  test();

  function test() {
    describe('DB Tests', function() {
      beforeEach(freshDB);

      it('onUpdate/onDestroy: should save to the historyDB 1', function() {
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

      it('revert on failed transactions', function() {
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

      it('should archive every entry', function() {
        return sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ])
          .then(assertCount(sequelize.models.UserHistory, 2))
          .then(() =>
            sequelize.models.User.update(
              { name: 'updated-foo' },
              { where: {}, individualHooks: true }
            )
          )
          .then(assertCount(sequelize.models.UserHistory, 4));
      });

      it('should revert under transactions', function() {
        return sequelize
          .transaction()
          .then(transaction => {
            const options = { transaction };
            return sequelize.models.User.bulkCreate(
              [{ name: 'foo1' }, { name: 'foo2' }],
              options
            )
              .then(assertCount(sequelize.models.UserHistory, 0))
              .then(assertCount(sequelize.models.UserHistory, 2, options))
              .then(() =>
                sequelize.models.User.update(
                  { name: 'updated-foo' },
                  {
                    where: {},
                    transaction
                  }
                )
              )
              .then(assertCount(sequelize.models.UserHistory, 0))
              .then(assertCount(sequelize.models.UserHistory, 4, options))
              .then(() => transaction.rollback());
          })
          .then(assertCount(sequelize.models.UserHistory, 0));
      });

      it('should revert on failed transactions, even when using after hooks', function() {
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

    describe('Association Tests', function() {
      describe('test there are no history association', function() {
        beforeEach(freshDB);
        it('Should have relations for origin models but not for history models', function() {
          const init = dataCreate();

          //Get User
          const user = init.then(() => sequelize.models.User.findOne());

          //User associations check
          const userHistory = user.then(u => {
            assert.notExists(
              u.getUserHistories,
              'User: getUserHistories exists'
            );
            return Promise.resolve('done');
          });

          const creation = user.then(u => {
            assert.exists(
              u.getCreatorCreations,
              'User: getCreatorCreations does not exist'
            );
            assert.exists(
              u.getUpdaterCreations,
              'User: getUpdaterCreations does not exist'
            );
            return u.getCreatorCreations();
          });

          //Creation associations check
          const creationHistory = creation.then(c => {
            assert.equal(c.length, 2, 'User: should have found 2 creations');
            const first = c[0];
            assert.notExists(
              first.getCreationHistories,
              'Creation: getCreationHistories exists'
            );
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
              assert.exists(
                first.getCreateUser,
                'Creation: getCreateUser does not exist'
              );
              assert.exists(
                first.getUpdateUser,
                'Creation: getUpdateUser does not exist'
              );
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
            assert.notExists(
              first.getTagHistories,
              'Tag: getTagHistories exists'
            );
            return Promise.resolve('done');
          });

          const tCreation = tag
            .then(t => {
              const first = t[0];
              assert.exists(
                first.getCreations,
                'Tag: getCreations does not exist'
              );
              return first.getCreations();
            })
            .then(tc => {
              assert.equal(tc.length, 2, 'Tag: should have found 2 creations');
              return Promise.resolve('done');
            });

          //Event associations check
          const eventHistory = event.then(e => {
            assert.exists(e, 'Creation: did not find event');
            assert.notExists(
              e.getEventHistories,
              'Event: getEventHistories exist'
            );
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
          const userHistories = init.then(
            assertCount(sequelize.models.UserHistory, 8)
          );
          const creationHistories = init.then(
            assertCount(sequelize.models.CreationHistory, 8)
          );
          const tagHistories = init.then(
            assertCount(sequelize.models.TagHistory, 12)
          );
          const eventHistories = init.then(
            assertCount(sequelize.models.EventHistory, 8)
          );
          const creationTagHistories = init.then(
            assertCount(sequelize.models.CreationTagHistory, 8)
          );

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
    });

    describe('hooks', function() {
      beforeEach(freshDB);
      it('onCreate: should store the new version in history db', function() {
        return sequelize.models.User.create({ name: 'test' }).then(
          assertCount(sequelize.models.UserHistory, 1)
        );
      });
      it('onUpdate/onDestroy: should save to the historyDB', function() {
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
      it('onUpdate: should store the previous version to the historyDB', function() {
        return sequelize.models.User.create({ name: 'foo' })
          .then(assertCount(sequelize.models.UserHistory, 1))
          .then(user => {
            user.name = 'bar';
            return user.save();
          })
          .then(assertCount(sequelize.models.UserHistory, 2))
          .then(() => sequelize.models.UserHistory.findAll())
          .then(users => {
            assert.equal(users.length, 2, 'multiple entries');
          })
          .then(user => sequelize.models.User.findOne())
          .then(user => user.destroy())
          .then(assertCount(sequelize.models.UserHistory, 3));
      });
      it('onDelete: should store the previous version to the historyDB', function() {
        return sequelize.models.User.create({ name: 'foo' })
          .then(assertCount(sequelize.models.UserHistory, 1))
          .then(user => user.destroy())
          .then(assertCount(sequelize.models.UserHistory, 2))
          .then(() => sequelize.models.UserHistory.findAll())
          .then(users => {
            assert.equal(users.length, 2, 'two entries');
          });
      });
    });

    describe('transactions', function() {
      beforeEach(freshDB);
      it('revert on failed transactions', function() {
        return sequelize
          .transaction()
          .then(transaction => {
            const options = { transaction };
            return sequelize.models.User.create({ name: 'not foo' }, options)
              .then(assertCount(sequelize.models.UserHistory, 1, options))
              .then(user => {
                user.name = 'foo';
                return user.save(options);
              })
              .then(assertCount(sequelize.models.UserHistory, 2, options))
              .then(() => transaction.rollback());
          })
          .then(assertCount(sequelize.models.UserHistory, 0));
      });
    });

    describe('bulk update', function() {
      beforeEach(freshDB);
      it('should archive every entry', function() {
        return sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ])
          .then(assertCount(sequelize.models.UserHistory, 2))
          .then(() =>
            sequelize.models.User.update({ name: 'updated-foo' }, { where: {} })
          )
          .then(assertCount(sequelize.models.UserHistory, 4));
      });
      it('should revert under transactions', function() {
        return sequelize
          .transaction()
          .then(transaction => {
            const options = { transaction };
            return sequelize.models.User.bulkCreate(
              [{ name: 'foo1' }, { name: 'foo2' }],
              options
            )
              .then(assertCount(sequelize.models.UserHistory, 2, options))
              .then(() =>
                sequelize.models.User.update(
                  { name: 'updated-foo' },
                  {
                    where: {},
                    transaction
                  }
                )
              )
              .then(assertCount(sequelize.models.UserHistory, 4, options))
              .then(() => transaction.rollback());
          })
          .then(assertCount(sequelize.models.UserHistory, 0));
      });
    });

    describe('bulk destroy/truncate', function() {
      beforeEach(freshDB);
      it('should archive every entry', function() {
        return sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ])
          .then(assertCount(sequelize.models.UserHistory, 2))
          .then(() =>
            sequelize.models.User.destroy({
              where: {},
              truncate: true // truncate the entire table
            })
          )
          .then(assertCount(sequelize.models.UserHistory, 4));
      });
      it('should revert under transactions', function() {
        return sequelize
          .transaction()
          .then(transaction => {
            const options = { transaction };
            return sequelize.models.User.bulkCreate(
              [{ name: 'foo1' }, { name: 'foo2' }],
              options
            )
              .then(assertCount(sequelize.models.UserHistory, 2, options))
              .then(() =>
                sequelize.models.User.destroy({
                  where: {},
                  truncate: true, // truncate the entire table
                  transaction
                })
              )
              .then(assertCount(sequelize.models.UserHistory, 4, options))
              .then(() => transaction.rollback());
          })
          .then(assertCount(sequelize.models.UserHistory, 0));
      });
    });

    describe('read-only ', function() {
      beforeEach(freshDB);
      it('should forbid updates', function() {
        const userUpdate = sequelize.models.UserHistory.create({
          name: 'bla00'
        }).then(uh => uh.update({ name: 'bla' }));

        // @ts-ignore
        return assert.isRejected(userUpdate, Error, 'Validation error');
      });
      it('should forbid deletes', function() {
        const userUpdate = sequelize.models.UserHistory.create({
          name: 'bla00'
        }).then(uh => uh.destroy());
        // @ts-ignore
        return assert.isRejected(userUpdate, Error, 'Validation error');
      });
    });

    describe('interference with the original model', function() {
      beforeEach(freshDB);
      it("shouldn't delete instance methods", function() {
        const Fruit = sequelize.define('Fruit', {
          name: DataTypes.TEXT
        });
        const FruitHistory = Temporalize({
          model: Fruit,
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

      it("shouldn't interfere with hooks of the model", function() {
        let triggered = 0;
        const Fruit = sequelize.define(
          'Fruit',
          { name: DataTypes.TEXT },
          {
            hooks: {
              beforeCreate: function() {
                triggered++;
              }
            }
          }
        );
        const FruitHistory = Temporalize({
          model: Fruit,
          sequelize,
          temporalizeOptions: {}
        });
        return sequelize
          .sync()
          .then(() => Fruit.create())
          .then(f => assert.equal(triggered, 1, 'hook trigger count'));
      });

      it("shouldn't interfere with setters", function() {
        let triggered = 0;
        const Fruit = sequelize.define('Fruit', {
          name: {
            type: DataTypes.TEXT,
            set: function() {
              triggered++;
            }
          }
        });
        const FruitHistory = Temporalize({
          model: Fruit,
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
