var mongodb = require('mongodb');
var pre = require('amoeba').pre;

var log = require('../log.js')('mongoClient.js');

module.exports = function(config){
  pre.hasProperty(config, 'connectionString');

  var mongoClient = null;

  return {
    withCollection: function(collection, errorCb, happyCb) {
      if (mongoClient == null) {
        return errorCb(new Error('Must start the mongoClient before using it.'));
      }

      if (happyCb == null) {
        happyCb = function(coll) {
          return errorCb(null, coll);
        };
      }
      mongoClient.collection(collection, function(err, collection) {
        if (err != null) {
          errorCb(err);
        }
        happyCb(collection);
      });
    },
    start: function(cb){
      if (mongoClient != null) {
        return;
      }

      if (cb == null) {
        cb = function(err) {
          if (err != null) {
            log.warn(err, 'Error connection to mongo!');
            return;
          }
          log.info('Successfully connected to mongo');
        }
      }

      mongodb.MongoClient.connect(config.connectionString, function(err, db){
        if (db != null) {
          if (mongoClient != null) {
            db.close();
            return;
          }
          mongoClient = db;
        }

        cb(err);
      });
    },
    close: function() {
      if (mongoClient != null) {
        mongoClient.close();
        mongoClient = null;
      }
    }
  }
};