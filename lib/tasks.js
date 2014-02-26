var ObjectID = require('mongodb').ObjectID;
var pre = require('amoeba').pre;

module.exports = function(db) {
  pre.hasProperty(db, 'syncTasks', 'db object on tasks must have a syncTasks collection');

  return {
    create: function(cb) {
      var self = this;

      // I have no clue why I have to do this, but for whatever reason, I don't get the created
      // task back from the save call.
      var id = new ObjectID().toString();
      db.syncTasks.save({_id: id, status: 'created'}, function(err, createdNum) {
        self.get(id, cb);
      });
    },
    get: function(id, cb) {
      db.syncTasks.findOne({_id: id}, cb);
    },
    update: function(task, cb) {
      db.syncTasks.save(task, cb);
    }
  }
};