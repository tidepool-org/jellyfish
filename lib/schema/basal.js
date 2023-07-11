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
var async = require('async');

var _ = require('lodash');

var schema = require('./schema.js');
var misc = require('../misc.js');

var idFields = ['type', 'deliveryType', 'deviceId', 'time'];
schema.registerIdFields('basal', idFields);

var mismatchedSeries = 'basal/mismatched-series';

function adjustDuration(curr, prev) {
  var actualDuration = Date.parse(curr.time) - Date.parse(prev.time);
  var findFabricatedBasalAnnotation = function(ann) {
    return ann.code === 'final-basal/fabricated-from-schedule';
  };
  var fabricatedAnnotation = _.find(prev.annotations || [], findFabricatedBasalAnnotation);
  if (fabricatedAnnotation !== undefined) {
    if (actualDuration !== prev.duration) {
      var newPrev = _.assign({}, prev, {
        duration: actualDuration,
        annotations: _.reject(prev.annotations, findFabricatedBasalAnnotation)
      });
      if (_.isEmpty(newPrev.annotations)) {
        return _.omit(newPrev, 'annotations');
      }
      else {
        return newPrev;
      }
    }
    else {
      var newPrevSameDuration = _.assign({}, prev, {
        annotations: _.reject(prev.annotations, findFabricatedBasalAnnotation)
      });
      if (_.isEmpty(newPrevSameDuration.annotations)) {
        return _.omit(newPrevSameDuration, 'annotations');
      }
      else {
        return newPrevSameDuration;
      }
    }
  }
  else if (actualDuration < prev.duration) {
    return _.assign({}, prev, {
      duration: actualDuration,
      expectedDuration: prev.duration
    });
  }
  // NB: we *intentionally* do not update the duration if actualDuration > prev.duration
  // because that could happen in situtations like the pump not being used for a month
  // in which case we would update the actualDuration to (falsely) be ~a month in duration
  else {
    return prev;
  }
}

module.exports = function(streamDAO){
  function updatePreviousDuration(dataOrDatum, cb) {
    const data = Array.isArray(dataOrDatum) ? dataOrDatum : [dataOrDatum];

    const minTime = data.reduce((currentMinTime, datum) => {
      return currentMinTime <= new Date(datum.time) ? currentMinTime : new Date(datum.time);
    }, new Date(data[0].time));

    const maxTime = data.reduce((currentMaxTime, datum) => {
      return currentMaxTime >= new Date(datum.time) ? currentMaxTime : new Date(datum.time);
    }, new Date(data[0].time));

    // Optimization for slow tandem uploads BACK-2514. Rather than the
    // original way of getting the previous entry one by one for each datum,
    // we find all datums between the min and max time of an input array of
    // data. This way we can check the previous with only one DB call. There
    // is a caveat though, because we have an array of data, the previous of
    // a datum might not exist in the database yet. It might be in the array.
    // So that is what we need to be mindful of. We need to check the results
    // from the database as well as the input array. If the previous datum
    // exists in the input array, use that over the database entry as that
    // indicates the previous datum needs to be updated as well, but only if
    // it is not a new insertion (.createdTime == null) (as that should fail
    // due to duplicate key).

    streamDAO.getDataInTimeRangeAndBefore(data[0], minTime, maxTime, (err, existingData) => {
      if (err) {
        return cb(err);
      }

      const {array, latestData, duplicates} = misc.removeDuplicates(existingData, data);

      function getLatestDatumBefore(datum) {
        const latestDataSorted = Object.values(latestData);
        latestDataSorted.sort(misc.sortTimeAsc);
        for (let i = latestDataSorted.length - 1; i > -1; i--) {
          const other = latestDataSorted[i];
          if (new Date(other.time) < new Date(datum.time)) {
            return other;
          }
        }
        return null;
      }

      // finalData will contain all datums that need to be inserted / updated.
      // This may include some data not in the original dataOrDatum parameter
      // because some datums in the database may need to be updated due to
      // them receiving a new annotation.
      const finalData = {};

      // When updating a datum, it needs to be updated in multiple places
      // potentially
      // - latestData, finalData, and array because the next datum processed
      //   may update an already updated datum.
      function updateDatum(datum) {
        finalData[datum._id] = datum;
        latestData[datum._id] = datum;
        for (let i = 0; i < array.length; i++) {
          if (_.isEqual(array[i]._id, datum._id)) {
            array[i] = datum;
            break;
          }
        }
      }

      function annotateDatumBefore(datum) {
        const disjointPrev = getLatestDatumBefore(datum);

        if (disjointPrev != null) {
          var annotate = true;
          if (disjointPrev.annotations != null) {
            for (var i = 0; i < disjointPrev.annotations.length; ++i) {
              if (disjointPrev.annotations[i].code === mismatchedSeries) {
                annotate = false;
              }
            }
          }

          if (annotate) {
            var adjustedPrev = adjustDuration(datum, disjointPrev);
            if (adjustedPrev != null) {
              // annotation makes a clone
              const annotated = schema.annotateEvent(
                adjustedPrev,
                { code: mismatchedSeries, nextId: schema.generateId(datum, idFields) }
              );
              updateDatum(annotated);
            }
          }
        }
      }

      array.forEach(datum => streamDAO.ensureInternalId(datum));

      // Handle the input array. The input array may modify data not inside
      // the input array such as previous entries in the db leading to more
      // data being inserted/modified than the size of the original input
      // array, dataOrDatum.
      for (let datum of array) {
        if (datum.previous != null) {
          var prevId = schema.generateId(datum.previous, idFields);
          var prevInternalId = streamDAO.generateInternalId(prevId, datum._groupId);
          const actualPrev = latestData[prevInternalId];

          if (actualPrev != null) {
            var adjustedPrev = adjustDuration(datum, actualPrev);
            if (adjustedPrev != null && !_.isEqual(adjustedPrev, actualPrev)) {
              updateDatum(adjustedPrev);
            }
          } else {
            annotateDatumBefore(datum);
          }
        } else {
          annotateDatumBefore(datum);
        }
        datum = _.omit(datum, 'previous');
        updateDatum(datum);
      }

      const finalArray = Object.values(finalData);
      finalArray.sort(misc.sortTimeAsc);
      cb(null, finalArray);
    });
  }

  return schema.makeSubHandler(
    'basal',
    'deliveryType',
    [
      schema.makeHandler(
        'automated',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            scheduleName: schema.ifExists(schema.isString),
            rate: schema.isNumber,
            duration: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0))),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          postTransform: updatePreviousDuration,
        }
      ),
      schema.makeHandler(
        'injected',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            value: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            insulin: schema.in('levemir', 'lantus')
          },
          postTransform: updatePreviousDuration,
        }
      ),
      schema.makeHandler(
        'scheduled',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            scheduleName: schema.ifExists(schema.isString),
            rate: schema.isNumber,
            duration: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0))),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          postTransform: updatePreviousDuration,
        }
      ),
      schema.makeHandler(
        'suspend',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            duration: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0))),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          postTransform: updatePreviousDuration,
        }
      ),
      schema.makeHandler(
        'temp',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            rate: schema.ifExists(schema.isNumber),
            percent: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0))),
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0)),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          transform: function(dataOrDatum, cb){
            const array = Array.isArray(dataOrDatum) ? dataOrDatum : [dataOrDatum];
            for (const datum of array) {
              if (datum.rate == null && datum.percent != null) {
                if (datum.suppressed != null && datum.suppressed.rate != null) {
                  datum.rate = datum.suppressed.rate * datum.percent;
                }
              }

              if (datum.rate == null && datum.percent == null) {
                return cb({ statusCode: 400, message: 'type[temp] must have either rate or percent specified.'});
              }
            }
            cb(null, dataOrDatum);
          },
          postTransform: updatePreviousDuration,
        }
      )
    ],
    updatePreviousDuration
  );
};
