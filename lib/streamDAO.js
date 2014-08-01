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

var misc = require('./misc.js');

module.exports = function(mongoClient){
  function updateDatumInternal(datum, count, cb) {
    if (count >= 10) {
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

        var prevOverrides = {
          _id: previous._id + '_' + previous._sequenceId,
          _active: false
        };

        // Insert the previous version first as an atomic operation.  This is logically the equivalent of optimistic
        // locking and what protects us from race conditions because Mongo doesn't have transactions.
        // Basically, if there is a race, one of them will update the previous object and the other will not.
        // The one that fails to update the previous needs to try again.
        coll.insert(_.assign(previous, prevOverrides), {j: true}, function(error){
          if (error != null) {
            if (error.code === 11000) {
              // The thing we want to insert already existed, so we need to try again.
              return updateDatumInternal(datum, count + 1, cb);
            }
            cb(error);
          }

          clone._sequenceId = previous._sequenceId + 1;
          clone._active = true;

          coll.update({_id: clone._id}, {$set: _.omit(clone, '_id')}, {j: true}, cb);
        });
      });
    });
  }

  function ensureId(datum) {
    if (datum._id == null) {
      datum._id = misc.generateId(datum.id, datum._groupId);
    }
    return datum
  }

  return {
    getDatum: function(id, groupId, cb) {
      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.findOne({_id: misc.generateId(id, groupId)}, cb);
      });
    },
    getDatumBefore: function(datum, cb) {
      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.find(
          {
            time: {$lt: datum.time},
            _groupId: datum._groupId,
            _active: true,
            type: datum.type,
            deviceId: datum.deviceId,
            source: datum.source
          })
          .sort({ "time": -1 })
          .limit(1)
          .toArray(function(err, arr) {
                     return cb(err, arr == null || arr.length === 0 ? null : arr[0])
                   });

      });
    },
    insertDatum: function(datum, cb) {
      pre.hasProperty(datum, 'id');
      pre.hasProperty(datum, '_groupId');

      datum = _.clone(datum);
      datum.createdTime = new Date().toISOString();
      datum._sequenceId = 0;
      datum._active = true;

      datum = ensureId(datum);

      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.insert(datum, function(err){
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
      pre.hasProperty(datum, '_groupId');
      updateDatumInternal(datum, 0, cb);
    },
    addOrUpdateDatum: function(datum, cb) {
      if (datum.createdTime == null) {
        this.insertDatum(datum, cb);
      } else {
        this.updateDatum(datum, cb);
      }
    },
    storeData: function(data, cb) {
      mongoClient.withCollection('deviceData', cb, function(collection, cb){
        collection.insert(data, {keepGoing: true}, cb);
      });
    },
    deleteData: function(groupId, cb) {
      mongoClient.withCollection('deviceData', cb, function(collection, cb){
        collection.remove({ groupId: groupId }, cb);
      });
    }
  }
};