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

module.exports = function(mongoClient){
  function updateDatumInternal(datum, count, cb) {
    if (count >= 10) {
      return cb(
        { statusCode: 503, message: util.format('Too much contention, giving up update after %s tries.', count) }
      );
    }

    var clone = _.clone(datum);
    clone.modifiedTime = new Date().toISOString();

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

  return {
    getDatum: function(id, cb) {
      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.findOne({_id: id}, cb);
      });
    },
    insertDatum: function(datum, cb) {
      pre.hasProperty(datum, 'groupId');

      datum.createdTime = new Date().toISOString();
      datum._sequenceId = 0;
      datum._active = true;

      mongoClient.withCollection('deviceData', cb, function(coll, cb){
        coll.insert(datum, cb);
      });
    },
    updateDatum: function(datum, cb) {
      pre.hasProperty(datum, 'groupId');
      updateDatumInternal(datum, 0, cb);
    },
    addOrUpdateDatum: function(datum, cb) {
      if (datum.createdTime == null) {
        insertDatum(datum, cb);
      } else {
        updateDatum(datum);
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