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
var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'upload',
  time: '2014-01-01T01:00:00.000Z',
  timezone: 'Pacific/Auckland',
  uploadId: '123-my-upload-id',
  byUser : '123-my-user-id',
  version: '0.101.0',
  deviceManufacturers: ['Medtronic'],
  deviceModel: 'Paradigm 522',
  deviceSerialNumber: '12345',
  deviceTags: ['insulin-pump'],
  deviceId: '123-my-upload-id',
  _groupId: 'g'
};

var badTidepoolUploaderObject = {
  type: 'upload',
  time: '2014-01-01T01:00:00.000Z',
  timezone: 'Pacific/Auckland',
  uploadId: '123-my-upload-id',
  byUser : '123-my-user-id',
  version: 'tidepool-uploader 0.1.0',
  deviceManufacturers: ['Medtronic'],
  deviceModel: 'Paradigm 522',
  deviceSerialNumber: '12345',
  deviceTags: ['insulin-pump'],
  deviceId: '123-my-upload-id',
  _groupId: 'g'
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
    it('of generic upload item', function(done) {
      helper.rejectIfAbsent(goodObject, 'version');
      helper.expectStringField(goodObject, 'version');
      done();
    });
    it('is rejected when its an outdated version', function(done) {
      helper.expectRejectionAndError(badTidepoolUploaderObject, {text: 'The minimum supported version is [0.99.0]. Version [tidepool-uploader 0.1.0] is no longer supported.', code: 'outdatedVersion', errorField: 'version'}, done);
    });
  });

  describe('deviceId', function(){
    helper.rejectIfAbsent(goodObject, 'deviceId');
    helper.expectStringField(goodObject, 'deviceId');
  });

  describe('deviceTags', function() {
    helper.rejectIfAbsent(goodObject, 'deviceTags');

    it('is an array', function(done) {
      var obj = _.cloneDeep(goodObject);
      obj.deviceTags = 1;
      helper.expectRejection(obj, 'deviceTags', done);
    });

    it('only accepts approved values', function(done) {
      var obj = _.cloneDeep(goodObject);
      obj.deviceTags = ['cgm', 'foo'];
      helper.expectRejection(obj, 'deviceTags', done);
    });
  });

  describe('deviceManufacturers', function() {
    helper.rejectIfAbsent(goodObject, 'deviceManufacturers');

    it('is an array', function(done) {
      var obj = _.cloneDeep(goodObject);
      obj.deviceManufacturers = 1;
      helper.expectRejection(obj, 'deviceManufacturers', done);
    });
  });

  describe('deviceModel', function() {
    helper.rejectIfAbsent(goodObject, 'deviceModel');
    helper.expectStringField(goodObject, 'deviceModel');
  });

  describe('deviceSerialNumber', function() {
    helper.rejectIfAbsent(goodObject, 'deviceSerialNumber');
    helper.expectStringField(goodObject, 'deviceSerialNumber');
  });

});