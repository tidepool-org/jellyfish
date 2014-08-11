/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var bolus = require('./bolus.js');
var schema = require('./schema.js');

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
    for (var i = 0; i < fields.length; ++i) {
      if (e[fields[i]] != null) {
        e[fields[i]] = schema.convertMgToMmol(e[fields[i]]);
      }
    }
    return e;
  };
}

module.exports = schema.makeHandler('settings', {
  schema: {
    activeSchedule: schema.isString,
    units: schema.and(schema.isObject, schema.ensureSchemaFn('units', unitsSchema)),
    basalSchedules: schema.isObjectWithValueSchema(basalSchedulesSchema),
    carbRatio: schema.or(carbRatioSchema, schema.isObjectWithValueSchema(carbRatioSchema)),
    insulinSensitivity: schema.or(insulinSensitivitySchema, schema.isObjectWithValueSchema(insulinSensitivitySchema)),
    bgTarget: schema.or(bgTargetArraySchema, schema.isObjectWithValueSchema(bgTargetArraySchema))
  },
  id: ['type', 'deviceId', 'time'],
  transform: function(datum, cb) {
    if (datum.basalSchedules[datum.activeSchedule] == null) {
      return cb(
        { statusCode: 400, message: util.format('activeSchedule[%s] not in basalSchedules', datum.activeSchedule)}
      );
    }

    datum.units.bg = schema.normalizeUnitName(datum.units.bg);
    if (datum.units.bg === 'mg/dL') {
      forEachItem(
        datum.insulinSensitivity,
        convertUnits('amount')
      );
      forEachItem(datum.bgTarget, convertBgTargetUnits);
    }

    cb(null, datum);
  }
});

module.exports.bgTargetSchema = bgTargetSchema;
module.exports.convertBgTargetUnits = convertBgTargetUnits;
