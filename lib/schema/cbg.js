/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

module.exports = schema.makeHandler('cbg', {
  schema: {
    value: schema.isNumber,
    isig: schema.ifExists(schema.isNumber)
  },
  id: ['type', 'deviceId', 'time'],
  transform: function(datum, cb) {
    return cb(null, schema.convertUnits(datum, 'value'));
  }
});