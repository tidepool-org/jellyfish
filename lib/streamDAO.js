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
var async = require('async');

var log = require('./log.js')('streamDAO.js');
var misc = require('./misc.js');
var schema = require('./schema/schema');


var fiveMinutes = 5 * 60 * 1000;
var maxRetries = 10;


var maxSuspendedDepth = 80;

function convertDates(entry) {
  if ('time' in entry && typeof(entry.time) === 'string') {
    entry.time = new Date(entry.time);
  }

  if ('createdTime' in entry && typeof(entry.createdTime) === 'string') {
    entry.createdTime = new Date(entry.createdTime);
  }

  if ('_archivedTime' in entry && typeof(entry._archivedTime) === 'number') {
    entry._archivedTime = new Date(entry._archivedTime);
  }

  if ('modifiedTime' in entry && typeof(entry.modifiedTime) === 'string') {
    entry.modifiedTime = new Date(entry.modifiedTime);
  }

  if ('suppressed' in entry) {
    convertDates(entry.suppressed);
  }

  if ('previous' in entry) {
    convertDates(entry.previous);
  }
}

function convertDatesToLegacy(entry) {
  if ('time' in entry && typeof(entry.time) === 'object') {
    entry.time = entry.time.toISOString();
  }

  if ('suppressed' in entry) {
    convertDatesToLegacy(entry.suppressed);
  }

  if ('previous' in entry) {
    convertDatesToLegacy(entry.previous);
  }
}

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
      datum.id = schema.generateId(datum, schema.idFields(datum.type));
    }

    // This is a migration step which converts times to native time objects before write to keep client changes minimal
    // it would be better if this could be done right at input, but its simpler this way.
    convertDates(datum);
  }

  return datum;
}

module.exports = function(mongoClient){
  function getCollectionName(datum) {
    return typeof datum?.type === 'string' && datum.type.toLowerCase() === 'upload' ? 'deviceDataSets' : 'deviceData';
  }

  async function updateDatumInternal(session, collection, datum) {
    var clone = _.clone(datum);
    clone.modifiedTime = new Date();
    clone = ensureInternalId(clone);

    let previous = await collection.findOne({_id: clone._id}, {session});
    if (previous == null) {
      throw { statusCode: 400, message: 'Asked to update a datum that doesn\'t exist' };
    }

    const modificationOpts = {
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true },
      session: session,
    };

    previous = _.assign(previous, {
      _id: previous._id + '_' + previous._version,
      _archivedTime: new Date(),
      _active: false
    });

    await collection.insertOne(previous, modificationOpts);

    clone.createdTime = previous.createdTime;
    clone._version = previous._version + 1;
    clone._active = true;
    return await collection.replaceOne({_id: clone._id}, _.omit(clone, '_id'), modificationOpts);
  }

  function generateInternalId(externalId, groupId) {
    return misc.generateId([externalId, groupId]);
  }

  function ensureInternalId(datum) {
    if (datum._id == null) {
      datum._id = generateInternalId(datum.id, datum._groupId);
    }
    return datum;
  }

  return {
    ensureInternalId: ensureInternalId,
    generateInternalId: generateInternalId,
    generateExternalId: function(datum) {
      return schema.generateId(datum, schema.idFields(datum.type));
    },

    getDatum: function(id, groupId, cb) {
      async function get() {
        const query = {_id: misc.generateId([id, groupId])};
        const obj = await mongoClient.collection('deviceDataSets').findOne(query);
        if (obj) {
          return obj;
        }
        return mongoClient.collection('deviceData').findOne(query);
      }
      const fn = util.callbackify(get);
      fn(cb);
    },
    // ugly naming but this gets all active datums of the same(type, deviceId,
    // source) within the closed interval [startTime, endTime] as well as the
    // latest datum whose time is before startTime.
    getDataInTimeRangeAndBefore: function(datum, startTime, endTime, cb) {
      mongoClient.withCollection('deviceData', cb, (coll, cb) => {
        const find = util.callbackify(() => {
          return coll.find({
            time: {$gte: startTime, $lte: endTime},
            _groupId: datum._groupId,
            _active: true,
            type: datum.type,
            deviceId: datum.deviceId,
            source: datum.source
          })
          .sort({ "time": -1 })
          .toArray();
        });

        find((err, arr) => {
          if (err == null && arr[0]) {
            arr = arr.map(obj => {
              convertDatesToLegacy(obj);
              return obj;
            });

            const earliestDatum = arr[arr.length - 1];
            this.getDatumBefore(earliestDatum, (err, earliestDoc) => {
              if (err) {
                return cb(err, arr);
              }
              if (earliestDoc) {
                arr.push(earliestDoc); // can push since sorted descending.
              }
              return cb(err, arr);
            });
          } else {
            return cb(err, arr);
          }
        });
      });
    },
    getDatumBefore: function(datum, cb) {
      mongoClient.withCollection(getCollectionName(datum), cb, function(coll, tempCb){
        const find = util.callbackify(() => {
          return coll.find({
            time: {$lt: new Date(datum.time)},
            _groupId: datum._groupId,
            _active: true,
            type: datum.type,
            deviceId: datum.deviceId,
            source: datum.source
          })
          .sort({ "time": -1 })
          .limit(1)
          .toArray();
        });

        find((err, arr) => {
          if (err == null && arr[0]) {
            convertDatesToLegacy(arr[0]);
          }
          return tempCb(err, arr[0]);
        });
      });
    },
    insertDatum: function(datum, cb) {
      var self = this;

      pre.hasProperty(datum, 'id');
      pre.hasProperty(datum, '_userId');
      pre.hasProperty(datum, '_groupId');

      datum = _.clone(datum);
      datum = filterDatumForMongo(datum);
      const now = new Date();
      datum.modifiedTime = now;
      datum.createdTime = now;
      datum._version = 0;
      datum._active = true;

      datum = ensureInternalId(datum);

      const errHandler = (err) => {
        if (err != null) {
          if (err.code === 11000) {
            return cb({ statusCode: 400, errorCode: 'duplicate', message: 'received a duplicate event'});
          }
          return cb(err);
        }
        cb(null, datum);
      };

      mongoClient.withCollection(getCollectionName(datum), cb, function(coll, cb){
        coll.insertOne(datum, errHandler);
      });
    },
    updateDatum: function(datum, cb) {
      pre.hasProperty(datum, 'id');
      pre.hasProperty(datum, '_userId');
      pre.hasProperty(datum, '_groupId');
      datum.modifiedTime = new Date();
      var filteredDatum = filterDatumForMongo(datum);

      let firstResult = null;
      // In order to handle concurrent updates / avoid lost updates we will
      // always run this in a transaction to mimick the behaviour of the
      // previous updateDatumInternal code.
      const updateInTx = async (session) => {
        const collection = mongoClient.collection(getCollectionName(datum));
        firstResult = await updateDatumInternal(session, collection, filteredDatum);
      };
      mongoClient.transact(updateInTx, (err) => {
        cb(err, firstResult);
      });
    },
    isNewDatum: function(datum) {
      return datum.createdTime == null;
    },
    addOrUpdateDatum: function(datum, cb) {
      if (this.isNewDatum(datum)) {
        this.insertDatum(datum, cb);
      } else {
        this.updateDatum(datum, cb);
      }
    },
    storeData: function(data, cb) {
      data.modifiedTime = new Date();
      mongoClient.withCollection(getCollectionName(data), cb, function(coll, cb){
          coll.insertOne(data, cb);
        });
    },
    deleteData: function(groupId, cb) {
      const deleteInTx = async (session) => {
        const dataSetColl = mongoClient.collection('deviceDataSets');
        const dataColl = mongoClient.collection('deviceData');
        // Not sure which of these delete results to return so just return
        // the deviceData delete _groupId one as the previous code did.
        await dataSetColl.deleteOne({ groupId: groupId }, {session});
        await dataSetColl.deleteOne({ _groupId: groupId }, {session});
        await dataColl.deleteOne({ groupId: groupId }, {session});
        await dataColl.deleteOne({ _groupId: groupId }, {session});
      };

      mongoClient.transact(deleteInTx, cb);
    },

    setSummaryOutdated: function(userId, typ, cb) {
      /*
      * NOTE we do not check the userId here, as we are assuming this is only running
      *      after successful datum insert
      */
      mongoClient.withCollection('summary', cb, function(coll, cb){
        let opts = { upsert : true };
        let timestamp = new Date();
        let update = { "$set": {"dates.outdatedSince": timestamp,
                                          "dates.hasOutdatedSince": true} };
        let selector = { "userId": userId, "type": typ };

        coll.findOne(selector, function(err, summary){
          if (err != null) {
            cb(err);
          } else if (summary?.dates?.outdatedSince === undefined || summary?.dates?.outdatedSince === null ) {
            coll.updateOne(selector, update, opts, function(err){
              if (err != null) {
                cb(err);
              }
              cb(null, timestamp);
            });
          } else {
            cb(null, summary.dates.outdatedSince);
          }
        });
      });
    },

    insertSummary: function(summary, cb) {
      //This function is currently unused for anything but tests
      mongoClient.withCollection('summary', cb, function(coll, cb){
        coll.insertOne(summary, cb);
      });
    },

    getSummary: function(userId, typ, cb) {
      //This function is currently unused for anything but tests
      mongoClient.withCollection('summary', cb, function(coll, cb){
        coll.findOne({'userId': userId, 'type': typ}, cb);
      });
    },

  };
};
