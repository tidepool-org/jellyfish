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
    const array = Array.isArray(dataOrDatum) ? dataOrDatum : [dataOrDatum];

    const minTime = array.reduce((currentMinTime, datum) => {
      return currentMinTime <= new Date(datum.time) ? currentMinTime : new Date(datum.time);
    }, new Date(array[0].time));

    const maxTime = array.reduce((currentMaxTime, datum) => {
      return currentMaxTime >= new Date(datum.time) ? currentMaxTime : new Date(datum.time);
    }, new Date(array[0].time));

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

    streamDAO.getDataInTimeRangeAndBefore(array[0], minTime, maxTime, (err, existingData) => {
      if (err) {
        return cb(err);
      }

      function sortTimeAsc(a, b) {
        const timeA = new Date(a.time);
        const timeB = new Date(b.time);
        if (timeA < timeB)
          return -1;
        if (timeA > timeB)
          return 1;
        return 0;
      }

      array.sort(sortTimeAsc);

      const latestData = {};
      for (const datum of existingData) {
        latestData[datum._id] = datum;
      }

      for (const datum of array) {
        // schema handlers only assign ids AFTER handler
        // but unfortunately we need the id now so we assign it here.
        if (!datum.id) {
          datum.id = schema.makeId(datum);
        }
        streamDAO.ensureInternalId(datum);

        // This would error out with a duplicate error if we are about to
        // insert this datum again. This does make basal know more about how
        // streamDAO works than it should but this code is only temporary
        // until everything is moved to platform.
        if (!datum.createdTime && latestData[datum._id]) {
          continue;
        }
        latestData[datum._id] = datum;
      }

      const latestDataSorted = Object.values(latestData);
      latestDataSorted.sort(sortTimeAsc);

      // Some data not part of the input original dataOrDatum parameter
      // maybe need to be updated due to them getting an annotation.
      // Because of this we need to include them in updates as well.
      const finalData = {};

      function annotateDatumBefore(datum) {
        // Note since latestDataSorted is already sorted we could just do a
        // more efficient binary search but the number of elements is small
        // enough to not care too much. Would use a findLast but node.js
        // version used too old.
        let disjointPrev = null;
        for (let i = latestDataSorted.length - 1; i > -1; i--) {
          const other = latestDataSorted[i];
          if (new Date(other.time) < new Date(datum.time)) {
            disjointPrev = other;
            break;
          }
        }

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
              finalData[annotated._id] = annotated;
              // check if it's in the array as well
              for (let i = 0; i < array.length; i++) {
                if (_.isEqual(array[i]._id, annotated._id)) {
                  array[i] = annotated;
                  break;
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < array.length; i++) {
        let datum = array[i];
        if (datum.previous != null) {
          var prevId = schema.generateId(datum.previous, idFields);
          var prevInternalId = streamDAO.generateInternalId(prevId, datum._groupId);
          const actualPrev = latestData[prevInternalId];

          if (actualPrev != null) {
            var adjustedPrev = adjustDuration(datum, actualPrev);
            if (adjustedPrev != null && !_.isEqual(adjustedPrev, actualPrev)) {
              finalData[adjustedPrev._id] = adjustedPrev;
              for (let j = 0; j < array.length; j++) {
                if (_.isEqual(array[j]._id, adjustedPrev._id)) {
                  array[j] = adjustedPrev;
                  break;
                }
              }
            }
          } else {
            annotateDatumBefore(datum);
          }
        } else {
          annotateDatumBefore(datum);
        }
        datum = _.omit(datum, 'previous');
        array[i] = datum;
        finalData[datum._id] = datum;
      }

      const finalArray = Object.values(finalData);
      finalArray.sort(sortTimeAsc);
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
