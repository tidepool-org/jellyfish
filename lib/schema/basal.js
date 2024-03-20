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
  function updatePreviousDuration(datum, cb) {
    var eventsToStore = [];
    function done() {
      eventsToStore.push(_.omit(datum, 'previous'));
      cb(null, eventsToStore);
    }

    function annotateDatumBefore() {
      streamDAO.getDatumBefore(datum, function(err, disjointPrev){
        if (err != null) {
          return cb(err);
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
              eventsToStore.push(schema.annotateEvent(
                adjustedPrev,
                { code: mismatchedSeries, nextId: schema.generateId(datum, idFields) }
              ));
            }
          }
        }
        done();
      });
    }


    if (datum.previous != null) {
      var prevId = schema.generateId(datum.previous, idFields);

      streamDAO.getDatum(prevId, datum._groupId, function(err, actualPrev){
        if (err != null) {
          return cb(err);
        }

        if (actualPrev != null) {
          var adjustedPrev = adjustDuration(datum, actualPrev);
          if (adjustedPrev != null && !_.isEqual(adjustedPrev, actualPrev)) {
            eventsToStore.push(adjustedPrev);
          }
          done();
        } else {
          annotateDatumBefore();
        }
      });
    } else {
      annotateDatumBefore();
    }
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
          transform: updatePreviousDuration
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
          }
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
          transform: updatePreviousDuration
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
          transform: function(datum, cb){
            return updatePreviousDuration(datum, cb);
          }
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
          transform: function(datum, cb){
            if (datum.rate == null && datum.percent != null) {
              if (datum.suppressed != null && datum.suppressed.rate != null) {
                datum.rate = datum.suppressed.rate * datum.percent;
              }
            }

            if (datum.rate == null && datum.percent == null) {
              return cb({ statusCode: 400, message: 'type[temp] must have either rate or percent specified.'});
            }

            return updatePreviousDuration(datum, cb);
          }
        }
      )
    ]
  );
};
