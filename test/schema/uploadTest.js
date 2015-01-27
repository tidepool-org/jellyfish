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

 /* global describe, before, beforeEach, it, after */

'use strict';

var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'upload',
  time: '2014-01-01T01:00:00.000Z',
  timezone: 'Pacific/Auckland',
  uploadId: '123-my-upload-id',
  byUser : '123-my-user-id',
  version: '0.86.0',
  deviceId: '123-my-upload-id'
};

describe('schema/upload.js', function(){
  describe('uploadId', function(){
    helper.rejectIfAbsent(goodObject, 'uploadId');
    helper.expectStringField(goodObject, 'uploadId');
  });

  describe('byUser', function(){
    helper.rejectIfAbsent(goodObject, 'byUser');
    helper.expectStringField(goodObject, 'byUser');
  });

  describe('timezone', function(){
    helper.rejectIfAbsent(goodObject, 'timezone');
    helper.expectStringField(goodObject, 'timezone');
  });

  describe('time', function(){
    helper.rejectIfAbsent(goodObject, 'time');
    helper.expectStringField(goodObject, 'time');
  });

  describe('version', function(){
    helper.rejectIfAbsent(goodObject, 'version');
    helper.expectStringField(goodObject, 'version');
  });

  describe('deviceId', function(){
    helper.rejectIfAbsent(goodObject, 'deviceId');
    helper.expectStringField(goodObject, 'deviceId');
  });

});