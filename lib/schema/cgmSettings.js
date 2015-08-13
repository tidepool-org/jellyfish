/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var schema = require('./schema.js');

var idFields = ['type', 'time', 'deviceId'];
schema.registerIdFields('cgmSettings', idFields);

var lowHighAlertsSchema = {
  enabled: schema.isBoolean,
  level: schema.isNumber,
  snooze: schema.isNumber
};

var rateOfChangeSchema = {
  enabled: schema.isBoolean,
  rate: schema.isNumber
};

var predictiveSchema = {
  enabled: schema.isBoolean,
  timeSensitivity: schema.isNumber
};

module.exports = schema.makeHandler('cgmSettings', {
  schema: {
    deviceTime: schema.validDeviceTime,
    transmitterId: schema.isString,
    // TODO: change to inputUnits when change everywhere
    units: schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'),
    displayUnits: schema.ifExists(schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl')),
    lowAlerts: schema.and(schema.isObject, schema.ensureSchemaFn('lowSettings', lowHighAlertsSchema)),
    highAlerts: schema.and(schema.isObject, schema.ensureSchemaFn('highSettings', lowHighAlertsSchema)),
    rateOfChangeAlerts: schema.and(schema.isObject, schema.ensureSchemaFn('rateOfChangeAlerts', {
      fallRate: schema.and(schema.isObject, schema.ensureSchemaFn('fallRate', rateOfChangeSchema)),
      riseRate: schema.and(schema.isObject, schema.ensureSchemaFn('riseRate', rateOfChangeSchema))
    })),
    outOfRangeAlerts: schema.ifExists(schema.and(schema.isObject, schema.ensureSchemaFn('outOfRangeAlerts', {
      enabled: schema.isBoolean,
      snooze: schema.isNumber
    }))),
    predictiveAlerts: schema.ifExists(schema.and(schema.isObject, schema.ensureSchemaFn('predictiveAlerts', {
      lowPrediction: schema.and(schema.isObject, schema.ensureSchemaFn('lowPrediction', predictiveSchema)),
      highPrediction: schema.and(schema.isObject, schema.ensureSchemaFn('highPrediction', predictiveSchema))
    }))),
    calibrationAlerts: schema.ifExists(schema.and(schema.isObject, schema.ensureSchemaFn('calibrationAlerts', {
      preReminder: schema.isNumber,
      overdueAlert: schema.isNumber
    })))
  },
  transform: function(datum, cb) {
    // TODO: change to inputUnits when change everywhere
    datum.units = schema.normalizeUnitName(datum.units);
    if (datum.displayUnits) {
      datum.displayUnits = schema.normalizeUnitName(datum.displayUnits);
    }

    if (datum.units === 'mg/dL') {
      datum.lowAlerts.level = schema.convertMgToMmol(datum.lowAlerts.level);
      datum.highAlerts.level = schema.convertMgToMmol(datum.highAlerts.level);
      datum.rateOfChangeAlerts.fallRate.rate = schema.convertMgToMmol(datum.rateOfChangeAlerts.fallRate.rate);
      datum.rateOfChangeAlerts.riseRate.rate = schema.convertMgToMmol(datum.rateOfChangeAlerts.riseRate.rate);
      datum.units = 'mmol/L';
    }
    
    cb(null, datum);
  }
});
