/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

module.exports = schema.makeHandler('grabbag', {
  schema: {
    subType: schema.isString
  },
  id: ['type', 'subType', 'time']
});