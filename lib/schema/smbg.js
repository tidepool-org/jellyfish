/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('smbg', idFields);

module.exports = schema.makeHandler('smbg', {
  schema: {
    value: schema.isNumber,
    units: schema.ifExists(schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'))
  },
  transform: function(datum, cb) {
    return cb(null, schema.convertUnits(datum, 'value'));
  }
});