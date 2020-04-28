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
var schema = require('./schema.js');

module.exports = (function () {
  var schemaEnv = {};

  // The version that we will accept upload requests from, will be in format of 0.200.0
  // NOTE: This will probably be eliminated in favor of using schemaVersion above for the same purpose
  schemaEnv.minimumUploaderVersion = config.fromEnvironment('MINIMUM_UPLOADER_VERSION', '0.99.0');

  return schemaEnv;
})();
