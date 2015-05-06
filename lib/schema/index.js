/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

'use strict';

function attachSchemas(schemas) {
  for (var i = 1; i < arguments.length; ++i) {
    schemas[arguments[i].key] = arguments[i];
  }
  return schemas;
}

module.exports = function(streamDAO) {
  return attachSchemas(
    {},
    require('./basal.js')(streamDAO),
    require('./bloodKetone.js'),
    require('./bolus.js')(streamDAO),
    require('./cbg.js'),
    require('./deviceMeta.js')(streamDAO),
    require('./food.js'),
    require('./grabbag.js'),
    require('./note.js')(streamDAO),
    require('./smbg.js'),
    require('./settings.js'),
    require('./cgmSettings.js'),
    require('./upload.js'),
    require('./urineKetone.js'),
    require('./wizard.js')
  );
};
