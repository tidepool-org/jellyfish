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

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'deviceId', 'time'];
schema.registerIdFields('bolus', idFields);

module.exports = function(streamDAO){

  function transformBoluses(data, cb) {
    const previousIds = data.filter(datum => !!datum.previous).map(datum => {
      const externalId = schema.generateId(datum.previous, idFields)
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
      for (const datum of data) {
        const externalId = schema.generateId(datum, idFields)
        const internalId = streamDAO.generateInternalId(externalId, datum._groupId);
        if (!datum.createdTime && latestData[datum._id]) {
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

      data.sort(sortTimeAsc);

      const finalData = {};
      for (const datum of data) {
        if (!datum.previous || ['injected', 'dual/square'].indexOf(datum.subType) > -1) {
          const externalId = schema.generateId(datum, idFields)
          const internalId = streamDAO.generateInternalId(externalId, datum._groupId);
          finalData[internalId] = datum;
          latestData[internalId] = datum;
          continue;
        }
        const prevExternalId = schema.generateId(datum.previous, idFields)
        const prevInternalId = streamDAO.generateInternalId(prevExternalId, datum._groupId);
        let prev = latestData[prevInternalId];
        // Todo logic depending on subType
        if (prev.normal !== datum.normal && ['normal', 'automated'].indexOf(datum.subType) > -1) {
          prev = _.clone(prev);
          prev.expectedNormal = prev.normal;
          prev.normal = datum.normal;
          finalData[prevInternalId] = prev;
          latestData[prevInternalId] = prev;
        }
        else if (datum.subType == 'square' && (prev.extended !== datum.extended || prev.duration !== datum.duration)) {
          prev = _.clone(prev);
          if (prev.extended !== datum.extended) {
            prev.expectedExtended = prev.extended;
            prev.extended = datum.extended;
          }

          if (prev.duration !== datum.duration) {
            prev.expectedDuration = prev.duration;
            prev.duration = datum.duration;
          }
          finalData[prevInternalId] = prev;
          latestData[prevInternalId] = prev;
        }
      }
      const finalArray = Object.values(finalData);
      finalArray.sort(sortTimeAsc);
      cb(null, finalArray);
    });
  }

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
          postTransform: function(datum, cb) {
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
          postTransform: function(datum, cb) {
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
          postTransform: function(datum, cb){
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
    ],
    transformBoluses
  );
};
