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

var util = require('util');

var _ = require('lodash');
var moment = require('moment');

var schema = require('./schema.js');

var INCOMPLETE_TUPLE = 'status/incomplete-tuple';
var UNKNOWN_PREV = 'status/unknown-previous';

var idFields = ['type', 'subType', 'time', 'deviceId'];
schema.registerIdFields('deviceMeta', idFields);

var suspendedReasons = {
  'manual': true,
  'low_glucose': true,
  'alarm': true
};

var resumedReasons = {
  'manual': true,
  'automatic': true
};

module.exports = function(streamDAO){
  return schema.makeSubHandler(
    'deviceMeta',
    'subType',
    [
      schema.makeHandler(
        'calibration',
        {
          schema: {
            value: schema.isNumber
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
            status: schema.in('suspended', 'resumed'),
            reason: schema.in(Object.keys(suspendedReasons), Object.keys(resumedReasons)),
            duration: schema.ifExists(schema.isNumber),
            previous: schema.ifExists(schema.isObject)
          },
          transform: function(datum, cb) {
            if ( (datum.status === 'suspended' && !suspendedReasons[datum.reason])
              || (datum.status === 'resumed' && !resumedReasons[datum.reason]) ) {
              return cb(
                { statusCode: 400, message: util.format('Unknown reason[%s] for status[%s]', datum.reason, datum.status) }
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

                  if (datum.status === 'resumed') {
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
      )
    ]
  );
};