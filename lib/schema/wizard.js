/*
 * == BSD2 LICENSE ==
 */

'use strict';

var bolus = require('./bolus.js');
var schema = require('./schema.js');

module.exports = schema.makeHandler('wizard', {
  schema: {
    recommended: schema.isNumber,
    bgInput: schema.ifExists(schema.isNumber),
    carbInput: schema.ifExists(schema.isNumber),
    activeInsulin: schema.ifExists(schema.isNumber),
    payload: schema.ifExists(schema.isObject),
    bolus: schema.ifExists(schema.or(schema.isObject, schema.isString))
  },
  id: ['type', 'deviceId', 'time'],
  transform: function(datum, cb) {
    if (datum.bolus != null && typeof(datum.bolus) === 'object') {
      datum.bolus = schema.generateId(datum.bolus, bolus.idFields);
    }

    cb(null, schema.convertUnits(datum, 'bgInput'));
  }
});