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

var idFields = ['type', 'subType', 'deviceId', 'time'];
schema.registerIdFields('bolus', idFields);
schema.registerFieldsForDuplicator('bolus', ['subType']);

module.exports = function(streamDAO){
  return schema.makeSubHandler(
    'bolus',
    'subType',
    [
      schema.makeHandler(
        'injected',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            value: schema.isNumber,
            insulin: schema.in('novolog', 'humalog')
          }
        }
      ),
      schema.makeHandler(
        'normal',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            normal: schema.isNumber
          },
          transform: function(datum, cb) {
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
                if (err != null) {
                  return cb(err);
                }

                if (prev.normal !== datum.normal) {
                  prev = _.clone(prev);
                  prev.expectedNormal = prev.normal;
                  prev.normal = datum.normal;
                  return cb(null, prev);
                }

                return cb(null, []);
              });
            }
          }
        }
      ),
      schema.makeHandler(
        'automated',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            normal: schema.isNumber
          },
          transform: function(datum, cb) {
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
                if (err != null) {
                  return cb(err);
                }

                if (prev.normal !== datum.normal) {
                  prev = _.clone(prev);
                  prev.expectedNormal = prev.normal;
                  prev.normal = datum.normal;
                  return cb(null, prev);
                }

                return cb(null, []);
              });
            }
          }
        }
      ),
      schema.makeHandler(
        'square',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0))
          },
          transform: function(datum, cb){
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
                if (err != null) {
                  return cb(err);
                }

                if (prev.extended !== datum.extended || prev.duration !== datum.duration) {
                  prev = _.clone(prev);
                  if (prev.extended !== datum.extended) {
                    prev.expectedExtended = prev.extended;
                    prev.extended = datum.extended;
                  }

                  if (prev.duration !== datum.duration) {
                    prev.expectedDuration = prev.duration;
                    prev.duration = datum.duration;
                  }

                  return cb(null, prev);
                }

                return cb(null, []);
              });
            }
          }
        }
      ),
      schema.makeHandler(
        'dual/square',
        {
          schema: {
            deviceTime: schema.validDeviceTime,
            normal: schema.isNumber,
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0))
          }
        }
      )
    ]
  );
};
