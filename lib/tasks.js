/*
 * == BSD2 LICENSE ==
 */

var ObjectID = require('mongodb').ObjectID;
var pre = require('amoeba').pre;

module.exports = function(mongoClient) {
  function syncTasks(errorCb, happyCb) {
    mongoClient.withCollection('syncTasks', errorCb, happyCb);
  }

  return {
    create: function(cb) {
      syncTasks(cb, function(collection){
        // Mongo doesn't give you the document you created back on insert, so we either have
        // to look it up again, or generate the ID here.  We choose the latter.
        var id = new ObjectID().toString();
        collection.insert({_id: id, status: 'created'}, function(err, result){
          cb(err, id);
        })
      });
    },
    get: function(id, cb) {
      syncTasks(cb, function(collection){
        collection.findOne({_id: id}, cb);
      });
    },
    save: function(task, cb) {
      syncTasks(cb, function(collection){
        collection.save(task, cb);
      });
    },
    update: function(taskId, updates, cb) {
      syncTasks(cb, function(collection){
        collection.update({_id: taskId}, updates, function(err, results){
          cb(err, results);
        });
      });
    },
    deleteAll: function(cb) {
      syncTasks(cb, function(collection){
        collection.remove(cb);
      });
    }
  }
};