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

var schema = require('./schema.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('pumpSettings', idFields);

function forEachItem(obj, fn) {
  if (Array.isArray(obj)) {
    obj.forEach(fn);
  } else {
    Object.keys(obj).forEach(function(key){
      obj[key].forEach(fn);
    });
  }
}

var unitsSchema = {
  carbs: schema.ifExists(schema.in('grams')),
  bg: schema.ifExists(schema.in('mg/dl', 'mg/dL', 'mmol/l', 'mmol/L'))
};

var basalSchedulesSchema = schema.isArrayWithValueSchema({
  rate: schema.isNumber,
  start: schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThan(86400000))
});

var carbRatioSchema = schema.isArrayWithValueSchema({
  amount: schema.isNumber,
  start: schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThan(86400000))
});

var insulinSensitivitySchema = schema.isArrayWithValueSchema({
  amount: schema.isNumber,
  start: schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThan(86400000))
});

var bgTargetSchema = schema.or(
  schema.ensureSchemaFn('bgTarget', { target: schema.isNumber }),
  schema.ensureSchemaFn('bgTarget', { target: schema.ifExists(schema.isNumber), low: schema.isNumber, high: schema.isNumber }),
  schema.ensureSchemaFn('bgTarget', { target: schema.isNumber, range: schema.isNumber }),
  schema.ensureSchemaFn('bgTarget', { target: schema.isNumber, high: schema.isNumber })
);
var bgTargetArraySchema = schema.isArrayWithValueSchema(
  schema.and(
    bgTargetSchema,
    schema.ensureSchemaFn(
      'bgTarget',
      { start: schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThan(86400000)) }
    )
  )
);
var convertBgTargetUnits = convertUnits('target', 'high', 'low', 'range');


function convertUnits() {
  var fields = arguments;

  return function(e) {
    if (e == null) {
      return null;
    }

    for (var i = 0; i < fields.length; ++i) {
      if (e[fields[i]] != null) {
        e[fields[i]] = schema.convertMgToMmol(e[fields[i]]);
      }
    }
    return e;
  };
}

module.exports = schema.makeHandler('pumpSettings', {
  schema: {
    deviceTime: schema.validDeviceTime,
    activeSchedule: schema.isString,
    units: schema.and(schema.isObject, schema.ensureSchemaFn('units', unitsSchema)),
    basalSchedules: schema.isObjectWithValueSchema(basalSchedulesSchema),
    carbRatio: schema.ifExists(carbRatioSchema),
    carbRatios: schema.ifExists(schema.isObjectWithValueSchema(carbRatioSchema)),
    insulinSensitivity: schema.ifExists(insulinSensitivitySchema),
    insulinSensitivities: schema.ifExists(schema.isObjectWithValueSchema(insulinSensitivitySchema)),
    bgTarget: schema.ifExists(bgTargetArraySchema),
    bgTargets: schema.ifExists(schema.isObjectWithValueSchema(bgTargetArraySchema))
  },
  transform: function(datum, cb) {
    if (datum.basalSchedules[datum.activeSchedule] == null) {
      return cb(
        { statusCode: 400, message: util.format('activeSchedule[%s] not in basalSchedules', datum.activeSchedule)}
      );
    }

    schema.requireXOR(datum, "carbRatio", "carbRatios");
    schema.requireXOR(datum, "insulinSensitivity", "insulinSensitivities");  
    schema.requireXOR(datum, "bgTarget", "bgTargets");

    datum.units.bg = schema.normalizeUnitName(datum.units.bg);
    if (datum.units.bg === 'mg/dL') {
      forEachItem(
        datum.insulinSensitivity == null ? datum.insulinSensitivities : datum.insulinSensitivity,
        convertUnits('amount')
      );
      forEachItem(datum.bgTarget == null ? datum.bgTargets : datum.bgTarget, convertBgTargetUnits);
    }

    cb(null, datum);
  }
});

module.exports.bgTargetSchema = bgTargetSchema;
module.exports.convertBgTargetUnits = convertBgTargetUnits;
