/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('cbg', idFields);

module.exports = schema.makeHandler('cbg', {
  schema: {
    value: schema.isNumber,
    isig: schema.ifExists(schema.isNumber),
    units: schema.ifExists(schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'))
  },
  id: idFields,
  transform: function(datum, cb) {
    return cb(null, schema.convertUnits(datum, 'value'));
  }
});