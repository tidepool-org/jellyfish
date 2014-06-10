/*
 * == BSD2 LICENSE ==
 */

'use strict';

var bolus = require('./bolus.js');
var schema = require('./schema.js');

module.exports = schema.makeHandler('wizard', {
  schema: {
    recommended: schema.isNumber,
    payload: schema.ifExists(schema.isObject),
    bolus: schema.ifExists(schema.isObject)
  },
  id: ['type', 'deviceId', 'time'],
  transform: function(datum, cb) {
    if (datum.bolus != null && typeof(datum.bolus) === 'object') {
      datum.bolus = schema.generateId(datum.bolus, bolus.idFields);
    }

    cb(null, datum);
  }
});