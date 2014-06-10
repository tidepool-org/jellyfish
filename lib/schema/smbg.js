/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

module.exports = schema.makeHandler('smbg', {
  schema: {
    value: schema.isNumber,
    units: schema.ifExists(schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'))
  },
  id: ['type', 'deviceId', 'time'],
  transform: function(datum, cb) {
    return cb(null, schema.convertUnits(datum, 'value'));
  }
});