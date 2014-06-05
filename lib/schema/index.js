/*
 * == BSD2 LICENSE ==
 */

'use strict';

function attachSchemas(schemas) {
  for (var i = 1; i < arguments.length; ++i) {
    schemas[arguments[i].key] = arguments[i];
  }
  return schemas
}

module.exports = function(streamDAO) {
  return attachSchemas(
    {},
    require('./basal.js')(streamDAO),
    require('./cbg.js'),
    require('./smbg.js')
  );
};
