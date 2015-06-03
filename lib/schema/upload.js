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

var schema = require('./schema.js');
var uploadConfig = require('./uploadEnv.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('upload', idFields);

module.exports = schema.makeHandler('upload', {
  schema: {
    timezone: schema.isString,
    uploadId: schema.isString,
    byUser: schema.isString,
    deviceTags: schema.isArrayWithValueSchema(schema.in(
      'insulin-pump',
      'cgm',
      'bgm',
      'fgm',
      'pen',
      'manual'
    )),
    deviceManufacturers: schema.isArrayWithValueSchema(schema.isString),
    deviceModel: schema.isString,
    deviceSerialNumber: schema.isString,
    version: schema.isString
  },
  transform: function(datum, cb) {

    var versionStr = datum.version.toLowerCase();
    console.log('Upload Item: raw version string ',versionStr);

    //TODO: longterm this check should be against the a datamodel and also probably not a hard go/no-go check also
    if ( versionStr.indexOf('tidepool-uploader') !== -1 ) {
      var versionNum = versionStr.split(' ')[1];
      console.log('Upload Item: raw version number =',versionNum);
      if ( schema.isValidVersion(versionNum, uploadConfig.minimumUploaderVersion)) {
        console.log('Upload Item: version check passed');
        return cb(null,datum);
      }
      console.log('Upload Item: version check FAILED expected [',uploadConfig.minimumUploaderVersion,'] got [', versionNum,']');
      return cb({ statusCode: 400, text : 'The minimum supported version is ['+uploadConfig.minimumUploaderVersion+']. Version ['+datum.version+'] is no longer supported.', code: 'outdatedVersion', errorField: 'version'});
    }
    return cb(null,datum);
  }
});