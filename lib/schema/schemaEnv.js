/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var config = require('amoeba').config;

module.exports = (function () {
  var schemaEnv = {};

  //Generic schemaVersion that will be applied to all datum type's.
  //NOTE: This will change to being different versions for different types over time
  schemaEnv.schemaVersion = config.fromEnvironment('SCHEMA_VERSION', 0);

  // The version that we will accept upload requests from, will be in format of 0.200.0
  // NOTE: This will be transitioned to a version of the datamodel
  schemaEnv.minimumUploaderVersion = config.fromEnvironment('MINIMUM_UPLOADER_VERSION', '0.99.0');

  return schemaEnv;
})();
