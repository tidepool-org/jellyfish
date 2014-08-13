/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');
var settings = require('./settings.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('wizard', idFields);

module.exports = schema.makeHandler('wizard', {
  schema: {
    recommended: schema.isObjectWithValueSchema(
      {
        carb: schema.ifExists(schema.isNumber),
        correction: schema.ifExists(schema.isNumber)
      }
    ),
    bgInput: schema.ifExists(schema.isNumber),
    carbInput: schema.ifExists(schema.isNumber),
    insulinOnBoard: schema.ifExists(schema.isNumber),
    insulinCarbRatio: schema.ifExists(schema.isNumber),
    insulinSensitivity: schema.ifExists(schema.isNumber),
    bgTarget: schema.ifExists(settings.bgTargetSchema),
    payload: schema.ifExists(schema.isObject),
    units: schema.ifExists(schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl')),
    bolus: schema.ifExists(schema.or(schema.isObject, schema.isString))
  },
  transform: function(datum, cb) {
    if (datum.bolus != null && typeof(datum.bolus) === 'object') {
      datum.bolus = schema.generateId(datum.bolus, schema.idFields('bolus'));
    }

    if (schema.normalizeUnitName(datum.units) === 'mg/dL') {
      datum.bgTarget = settings.convertBgTargetUnits(datum.bgTarget);
    }

    cb(null, schema.convertUnits(datum, 'bgInput', 'insulinSensitivity'));
  }
});