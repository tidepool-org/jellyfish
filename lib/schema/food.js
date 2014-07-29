/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

module.exports = schema.makeHandler('food', {
  schema: {
    carbs: schema.isNumber,
    protein: schema.ifExists(schema.isNumber),
    fat: schema.ifExists(schema.isNumber),
    location: schema.ifExists(schema.isString),
    name: schema.ifExists(schema.isString)
  },
  id: ['type', 'deviceId', 'time']
});