/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var pre = require('amoeba').pre;

var log = require('./log.js')('streamDAO.js');
var misc = require('./misc.js');


var datumConfig = require('./schema/schemaEnv.js');

var fiveMinutes = 5 * 60 * 1000;
var maxRetries = 10;


var maxSuspendedDepth = 80;

function filterDatumForMongo(datum) {
  // Filters Datum for bad characteristics.  This is a fix for problems with data that was accepted by earlier version of mongo
  // but will cause problems for versions of mongo > 3.4.  Currently - the only problem fixed is truncating the
  // payload.suspended nested structure to 80 levels
  if (datum) {
    for (var entry = datum.payload, i = 0; entry && entry.suspended; entry = entry.suspended, i++) {
      if (i === maxSuspendedDepth) {
        delete entry.suspended;
        break;
      }
    }

    // This is a fix for a problem with the uploader including apostrophes for a 2 month period
    // Jira reference - BACK-1379
    var BadDeviceIDPrefix = "InsOmn'";
    var GoodDeviceIDPrefix = "InsOmn";
    if ('deviceId' in datum && datum.deviceId.includes(BadDeviceIDPrefix)) {
      datum.deviceId = datum.deviceId.replace(BadDeviceIDPrefix, GoodDeviceIDPrefix);
    }
  }
  return datum;
}

module.exports = function(mongoClient){
  function updateDatumInternal(datum, count, cb) {
    if (count >= maxRetries) {
      return cb(
        { statusCode: 503, message: util.format('Too much contention, giving up update after %s tries.', count) }
      );
    }

    var clone = _.clone(datum);
    clone.modifiedTime = new Date().toISOString();
    clone = ensureId(clone);

    mongoClient.withCollection('deviceData', cb, function(coll, cb){
      coll.findOne({_id: clone._id}, function(err, previous){
        if (err != null) {
          return cb(err);
        }

        if (previous == null) {
          return cb({ statusCode: 400, message: 'Asked to update a datum that doesn\'t exist' });
        }

        previous = _.assign(previous, {
          _id: previous._id + '_' + previous._version,
          _archivedTime: Date.now(),
          _active: false
        });

        function updateItem() {
          clone.createdTime = previous.createdTime;
          clone._version = previous._version + 1;
          clone._active = true;

          coll.replaceOne({_id: clone._id}, _.omit(clone, '_id'), {j: true}, cb);
        }

        // Insert the previous version first as an atomic operation.  This is logically the equivalent of optimistic
        // locking and what protects us from race conditions because Mongo doesn't have transactions.
        // Basically, if there is a race, one of them will update the previous object and the other will not.
        // The one that fails to update the previous needs to try again.
        coll.insertOne(previous, {j: true}, function(error){
          if (error != null) {
            if (error.code === 11000) {
              if (count === 0) {
                return coll.findOne({_id: previous._id}, function(err, collidingPrev) {
                  if (err != null) {
                    return cb(err);
                  }

                  // If we are colliding with an object that was archived more than 5 minutes ago (or existed before
                  // we started storing the _archivedTime field), then it is likely that the final update to the datum
                  // failed for some reason.  In this case, we need to consider the previous update as lost and just
                  // get on with our lives, which is what we do here.  We update the "_archivedTime" to reflect the
                  // fact that this update is now taking on the archival and then update the item.
                  if (collidingPrev._archivedTime == null || Date.now() - collidingPrev._archivedTime > fiveMinutes) {
                    return coll.findAndModify(
                      {_id: previous._id, _archivedTime: collidingPrev._archivedTime},
                      [['_id', -1]],
                      { $set: {_archivedTime: Date.now()} },
                      { j: true },
                      function(err) {
                        if (err != null) {
                          return cb(err);
                        }
                        updateItem();
                      }
                    );
                  } else {
                    // try again
                    return setTimeout(function(){ updateDatumInternal(datum, count + 1, cb); }, 30);
                  }
                });
              } else {
                // The thing we want to insert already existed, so we need to try again.
                return setTimeout(function(){ updateDatumInternal(datum, count + 1, cb); }, 30);
              }
            }
            cb(error);
          }

          updateItem();
        });
      });
    });
  }

  function ensureId(datum) {
    if (datum._id == null) {
      datum._id = misc.generateId([datum.id, datum._groupId]);
    }
    return datum;
  }

  return {
    getDatum: function(id, groupId, cb) {
      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.findOne({_id: misc.generateId([id, groupId])}, cb);
      });
    },
    getDatumBefore: function(datum, cb) {
      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.find(
          {
            time: {$lt: datum.time},
            _groupId: datum._groupId,
            _active: true,
            _schemaVersion: datumConfig.schemaVersion,    // NOTE: This will need to be updated per type in the future.
            type: datum.type,
            deviceId: datum.deviceId,
            source: datum.source
          })
          .sort({ "time": -1 })
          .limit(1)
          .toArray(function(err, arr) {
                     return cb(err, arr == null || arr.length === 0 ? null : arr[0]);
                   });

      });
    },
    insertDatum: function(datum, cb) {
      var self = this;

      pre.hasProperty(datum, 'id');
      pre.hasProperty(datum, '_userId');
      pre.hasProperty(datum, '_groupId');

      datum = _.clone(datum);
      datum.createdTime = new Date().toISOString();
      datum._version = 0;
      datum._active = true;
      //NOTE: At this moment all datums have a _schemaVersion set the same but over time it will be updated on a per type basis.
      //This would likely happen in each individual type's schema file in the ./schema directory
      datum._schemaVersion = datumConfig.schemaVersion;

      datum = ensureId(datum);

      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.insertOne(datum, function(err){
          if (err != null) {
            if (err.code === 11000) {
              return cb({ statusCode: 400, errorCode: 'duplicate', message: 'received a duplicate event'});
            }
            return cb(err);
          }
          return cb(null, datum);
        });
      });
    },
    updateDatum: function(datum, cb) {
      pre.hasProperty(datum, 'id');
      pre.hasProperty(datum, '_userId');
      pre.hasProperty(datum, '_groupId');
      updateDatumInternal(datum, 0, cb);
    },
    addOrUpdateDatum: function(datum, cb) {
      var filteredDatum = filterDatumForMongo(datum);
      if (datum.createdTime == null) {
        this.insertDatum(filteredDatum, cb);
      } else {
        this.updateDatum(filteredDatum, cb);
      }
    },
    storeData: function(data, cb) {
      mongoClient.withCollection('deviceData', cb, function(collection, cb){
        collection.insertOne(data, {keepGoing: true}, cb);
      });
    },
    deleteData: function(groupId, cb) {
      mongoClient.withCollection('deviceData', cb, function(collection, cb){
        collection.deleteOne({ groupId: groupId }, function(err){
          if (err != null) {
            cb(err);
          } else {
            collection.deleteOne({ _groupId: groupId }, cb);
          }
        });
      });
    }
  };
};
