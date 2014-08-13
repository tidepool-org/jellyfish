/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'time'];
schema.registerIdFields('grabbag', idFields);

module.exports = schema.makeHandler('grabbag', {
  schema: {
    subType: schema.isString
  },
  id: idFields
});