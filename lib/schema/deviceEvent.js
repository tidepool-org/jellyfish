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
    ]
  );
};
