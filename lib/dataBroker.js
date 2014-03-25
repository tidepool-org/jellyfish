/*
 * == BSD2 LICENSE ==
 */

module.exports = function(mongoClient){
  return {
    storeData: function(data, cb) {
      mongoClient.withCollection('deviceData', function(err, collection) {
        if (err != null) {
          return cb(err);
        }
        collection.insert(data, {keepGoing: true}, cb);
      });
    },
    deleteData: function(groupId, cb) {
      mongoClient.withCollection('deviceData', function(err, collection) {
        if (err != null) {
          return cb(err);
        }
        collection.remove({ groupId: groupId }, cb);
      })
    }
  }
};