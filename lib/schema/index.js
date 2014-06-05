/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

module.exports = schema.makeHandlers({
  cbg: require('./cbg.js')
});