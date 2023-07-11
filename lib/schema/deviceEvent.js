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
var moment = require('moment');

var schema = require('./schema.js');

var INCOMPLETE_TUPLE = 'status/incomplete-tuple';
var UNKNOWN_PREV = 'status/unknown-previous';

var idFields = ['type', 'subType', 'time', 'deviceId'];
schema.registerIdFields('deviceEvent', idFields);

var statusReasons = ['manual', 'automatic'];

var reasonSchema = schema.and(
  schema.isObject,
  schema.ensureSchemaFn('reason', {
    suspended: schema.ifExists(schema.in(statusReasons)),
    resumed: schema.ifExists(schema.in(statusReasons)),
  })
);

var changeSchema = schema.and(
  schema.isObject,
  schema.ensureSchemaFn('change', {
    from: schema.validDeviceTime,
    to: schema.validDeviceTime,
    agent: schema.in('manual', 'automatic'),
    reasons: schema.ifExists(schema.isArrayWithValueSchema(schema.in(
      'from_daylight_savings',
      'to_daylight_savings',
      'travel',
      'correction',
      'other'
    ))),
    timezone: schema.ifExists(schema.isString)
  })
);

module.exports = function(streamDAO){
   function transformDeviceEvents(data, cb) {
    const previousIds = data.filter(datum => !!datum.previous).map(datum => {
      const externalId = schema.generateId(datum.previous, idFields);
      return streamDAO.generateInternalId(externalId, datum._groupId);
    });
    streamDAO.getDataIn(previousIds, (err, existingData) => {
      if (err) {
        return cb(err);
      }
      const latestData = {};
      for (const datum of existingData) {
        latestData[datum._id] = datum;
      }

      // This is used to mimick the previous code's that will only perform the first insert
      // of a given datum's id, and return a duplicate error for the rest.
      const arrayIndicesToSkip = {};
      data.sort(sortTimeAsc);
      for (let i = 0; i < data.length; i++) {
        const datum = data[i];
        const externalId = schema.generateId(datum, idFields);
        const internalId = streamDAO.generateInternalId(externalId, datum._groupId);
        if (!datum.createdTime && latestData[internalId]) {
          arrayIndicesToSkip[i] = true;
          continue;
        }
        latestData[internalId] = datum;
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

      const finalData = {};
      for (let i = 0; i < data.length; i++) {
        const datum = data[i];
        if (arrayIndicesToSkip[i]) {
          continue;
        }
        const externalId = schema.generateId(datum, idFields);
        const internalId = streamDAO.generateInternalId(externalId, datum._groupId);

        // The check for "previous" datums only applies to deviceEvent datum where .subType == 'status'
        if (datum.subType != 'status') {
          finalData[internalId] = datum;
          latestData[internalId] = datum;
          continue;
        }

        if (datum.previous != null) {
          const prevExternalId = schema.generateId(datum.previous, idFields);
          const prevInternalId = streamDAO.generateInternalId(prevExternalId, datum._groupId);
          let prev = latestData[prevInternalId];

          if (prev == null) {
            const updatedDatum = schema.annotateEvent(datum, {code: UNKNOWN_PREV, id: prevExternalId});
            finalData[internalId] = updatedDatum;
            latestData[internalId] = updatedDatum;
          } else  {
            prev = schema.removeAnnotation(prev, INCOMPLETE_TUPLE);
            prev.duration = moment.utc(datum.time).valueOf() - moment.utc(prev.time).valueOf();
            prev.reason = _.assign({}, prev.reason, datum.reason);

            if (datum.status === 'resumed') {
              var prevPayload = _.clone(prev.payload) || {};
              var thisPayload = _.clone(datum.payload) || {};
              if (!_.isEmpty(prevPayload)) {
                prev.payload = _.assign({}, {suspended: prevPayload});
              }
              if (!_.isEmpty(thisPayload)) {
                prev.payload = _.assign({}, prev.payload, {resumed: thisPayload});
              }
              latestData[prevInternalId] = prev;
              finalData[prevInternalId] = prev;
            } else {
              latestData[prevInternalId] = prev;
              finalData[prevInternalId] = prev;
              const updatedDatum = schema.annotateEvent(datum, INCOMPLETE_TUPLE);
              latestData[internalId] = updatedDatum;
              finalData[internalId] = updatedDatum;
            }
          }
        } else {
          if (datum.status === 'resumed') {
            const updatedDatum = schema.annotateEvent(datum, UNKNOWN_PREV);
            latestData[internalId] = updatedDatum;
            finalData[internalId] = updatedDatum;
          } else {
            const updatedDatum = schema.annotateEvent(datum, INCOMPLETE_TUPLE);
            latestData[internalId] = updatedDatum;
            finalData[internalId] = updatedDatum;
          }
        }
      }

      const finalArray = Object.values(finalData);
      finalArray.sort(sortTimeAsc);
      cb(null, finalArray);
    });
  }

  return schema.makeSubHandler(
    'deviceEvent',
    'subType',
    [
      schema.makeHandler(
        'calibration',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            value: schema.isNumber,
            units: schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl')
          },
          transform: function(datum, cb) {
            return cb(null, schema.convertUnits(datum, 'value'));
          }
        }
      ),
      schema.makeHandler(
        'status',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            status: schema.in('suspended', 'resumed'),
            reason: reasonSchema,
            duration: schema.ifExists(schema.isNumber),
            previous: schema.ifExists(schema.isObject)
          },
          transform: function(datum, cb) {
            var reason = datum.reason.suspended ? datum.reason.suspended : datum.reason.resumed;
            if (!_.includes(statusReasons, reason)) {
              return cb(
                { statusCode: 400, message: util.format('Unknown reason[%s] for status[%s]', reason, datum.status) }
              );
            }
            cb(null, datum);
          },

          postTransform: function(datum, cb) {
            if (datum.previous != null) {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev) {
                if (err != null) {
                  return cb(err);
                }

                if (prev == null) {
                  datum = schema.annotateEvent(datum, {code: UNKNOWN_PREV, id: prevId});
                  return cb(null, datum);
                } else  {
                  prev = schema.removeAnnotation(prev, INCOMPLETE_TUPLE);
                  prev.duration = moment.utc(datum.time).valueOf() - moment.utc(prev.time).valueOf();
                  prev.reason = _.assign({}, prev.reason, datum.reason);

                  if (datum.status === 'resumed') {
                    var prevPayload = _.clone(prev.payload) || {};
                    var thisPayload = _.clone(datum.payload) || {};
                    if (!_.isEmpty(prevPayload)) {
                      prev.payload = _.assign({}, {suspended: prevPayload});
                    }
                    if (!_.isEmpty(thisPayload)) {
                      prev.payload = _.assign({}, prev.payload, {resumed: thisPayload});
                    }
                    return cb(null, prev);
                  } else {
                    return cb(null, [prev, schema.annotateEvent(datum, INCOMPLETE_TUPLE)]);
                  }
                }
              });
            } else {
              if (datum.status === 'resumed') {
                return cb(null, schema.annotateEvent(datum, UNKNOWN_PREV));
              } else {
                return cb(null, schema.annotateEvent(datum, INCOMPLETE_TUPLE));
              }
            }
          }
        }
      ),
      schema.makeHandler(
        'alarm',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            alarmType: schema.in(
                'low_insulin',
                'no_insulin',
                'low_power',
                'no_power',
                'occlusion',
                'no_delivery',
                'auto_off',
                'over_limit',
                'other'
              ),
            payload: schema.ifExists(schema.isObject),
            status: schema.ifExists(schema.isObject)
          },
          transform: function(datum, cb) {
            if (datum.status != null) {
              datum.status = schema.generateId(datum.status, idFields);
            }
            return cb(null, datum);
          }
        }
      ),
      schema.makeHandler(
        'reservoirChange',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            payload: schema.ifExists(schema.isObject),
            status: schema.ifExists(schema.isObject)
          },
          transform: function(datum, cb) {
            if (datum.status != null) {
              datum.status = schema.generateId(datum.status, idFields);
            }
            return cb(null, datum);
          }
        }
      ),
      schema.makeHandler(
        'prime',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            primeTarget: schema.in('cannula', 'tubing'),
            volume: schema.ifExists(schema.isNumber)
          }
        }
      ),
      schema.makeHandler(
        'timeChange',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            change: changeSchema,
            payload: schema.ifExists(schema.isObject)
          }
        }
      ),
      schema.makeHandler(
        'pumpSettingsOverride',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            overrideType: schema.in('physicalActivity', 'sleep'),
            method: schema.ifExists(schema.in('automatic', 'manual')),
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThanEq(604800000)),
            payload: schema.ifExists(schema.isObject)
          }
        }
      )
    ],
    transformDeviceEvents
  );
};
