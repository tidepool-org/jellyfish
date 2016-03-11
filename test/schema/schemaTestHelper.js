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

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var mockableObject = salinity.mockableObject;

exports.streamDAO = mockableObject.make('getDatum', 'getDatumBefore');
exports.schema = require('../../lib/schema')(exports.streamDAO);

exports.resetMocks = function(){
  mockableObject.reset(exports.streamDAO);
};

exports.run = function(datum, cb, expectation) {
  return exports.schema[datum.type](datum, function(err){
    if (expectation == null) {
      return cb.apply(null, Array.prototype.slice.call(arguments, 0));
    }

    if (err != null) {
      return cb(err);
    }
    expectation.apply(null, Array.prototype.slice.call(arguments, 1));
    cb();
  });
};

exports.expectRejection = function(object, field, cb) {
  exports.run(object, function(err){
    expect(err).to.exist;
    expect(err.statusCode).equals(400);
    expect(err.message).to.match(new RegExp(field));
    cb();
  });
};

exports.expectRejectionAndError = function(object, expectedError, cb) {
  exports.run(object, function(err){
    expect(err).to.exist;
    expect(err.statusCode).equals(400);
    expect(err.text).equals(expectedError.text);
    expect(err.code).equals(expectedError.code);
    expect(err.errorField).equals(expectedError.errorField);
    cb();
  });
};

exports.rejectIfAbsent = function(goodObject, field) {
  it(util.format('rejects if field[%s] is not present', field), function(done){
    exports.expectRejection(_.omit(goodObject, field), field, done);
  });
};

exports.rejectIfNeither = function(object, field1, field2) { 
  it(util.format('rejects if neither field[%s] nor field[%s] is present', field1, field2), function(done) {
    exports.expectRejection(_.omit(object, field1, field2), field1, done);
  });
};

exports.okIfAbsent = function(goodObject, field) {
  it(util.format('allows the field[%s] to be absent', field), function(done){
    exports.run(_.omit(goodObject, field), done);
  });
};

exports.expectNotNumberField = function(goodObject, field) {
  it('rejects numeric value', function(done){
    var toAdjust = {};
    toAdjust[field] = 1;
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.expectNotObjectField = function(goodObject, field) {
  it('rejects object value', function(done){
    var toAdjust = {};
    toAdjust[field] = { howdy: 'honda' };
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.expectNotStringField = function(goodObject, field) {
  it('rejects string value', function(done){
    var toAdjust = {};
    toAdjust[field] = '1';
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.expectBooleanField = function(goodObject, field) {
  exports.expectNotNumberField(goodObject, field);
  exports.expectNotObjectField(goodObject, field);
  exports.expectNotNumberField(goodObject, field);
};

exports.expectStringField = function(goodObject, field) {
  exports.expectNotNumberField(goodObject, field);
  exports.expectNotObjectField(goodObject, field);
};

exports.expectNumericalField = function(goodObject, field) {
  exports.expectNotStringField(goodObject, field);
  exports.expectNotObjectField(goodObject, field);
};

exports.expectObjectField = function(goodObject, field) {
  exports.expectNotStringField(goodObject, field);
  exports.expectNotNumberField(goodObject, field);
};

exports.expectFieldIn = function(goodObject, field, possibles, expects) {
  _.each(possibles, function(p, idx) {
    it('permits a value of "' + p + '"', function(done) {
      var poss = {};
      poss[field] = p;
      exports.run(_.assign({}, goodObject, poss), function(err, val) {
        expect(err).to.not.exist;
        var expected = p;
        if (expects != null) {
          expected = expects[idx];
        }
        expect(val[field]).equals(expected);
        done(err);
      });
    });
  });
  it('does not permit an inappropriate value.', function(done) {
    var poss = {};
    poss[field]='USELESS_VALUE';
    exports.expectRejection(_.assign({}, goodObject, poss), field, done);
  });
};

exports.expectSubsetEqual = function(lhs, rhs) {
  expect(_.pick(lhs, Object.keys(rhs))).deep.equals(rhs);
};

exports.expectUnitConversion = function(goodObject, field) {
  it('converts "mmol/l" to "mmol/L"', function(done){
    var splatMe = { units: 'mmol/l' };
    splatMe[field] = 80;
    exports.run(_.assign({}, goodObject, splatMe), function(err, val){
      expect(val.units).equals('mmol/L');
      expect(val[field]).equals(80);
      done(err);
    });
  });

  it('converts units from mg/dL to mmol/L', function(done){
    var splatMe = { units: 'mg/dL' };
    splatMe[field] = 80;
    exports.run(_.assign({}, goodObject, splatMe), function(err, val){
      expect(val.units).equals('mmol/L');
      expect(val[field]).equals(4.440598392836427);
      done(err);
    });
  });

  it('converts units from mg/dl to mmol/L', function(done){
    var splatMe = { units: 'mg/dl' };
    splatMe[field] = 80;
    exports.run(_.assign({}, goodObject, splatMe), function(err, val){
      expect(val.units).equals('mmol/L');
      expect(val[field]).equals(4.440598392836427);
      done(err);
    });
  });
};

exports.testCommonFields = function(goodObject) {
  describe('deviceTime', function(){
    it('accepts timestamps in ISO 8601 format w/no timezone info', function(done){
      exports.run(_.assign({}, goodObject, {deviceTime: '2015-01-01T00:05:25'}), function(err, val){
        if (Array.isArray(val)) {
          expect(val).length(1);
          val = val[0];
        }
        expect(val.deviceTime).equals('2015-01-01T00:05:25');
        done(err);
      });
    });
    it('rejects non-string time', function(done){
      exports.expectRejection(
        _.assign({}, goodObject, {time: new Date('2014-01-01T01:01:00.000Z').valueOf()}), 'time', done
      );
    });
  });

  describe('time', function(){
    exports.rejectIfAbsent(goodObject, 'time');

    it('accepts timestamps in non-Zulu time and converts them', function(done){
      exports.run(_.assign({}, goodObject, {time: '2014-01-01T04:15:00.000+03:15'}), function(err, val){
        if (Array.isArray(val)) {
          expect(val).length(1);
          val = val[0];
        }
        expect(val.time).equals('2014-01-01T01:00:00.000Z');
        done(err);
      });
    });
    it('rejects timestamps without a timezone', function(done){
      exports.expectRejection(_.assign({}, goodObject, {time: '2014-01-01'}), 'time', done);
    });
    it('rejects non-string time', function(done){
      exports.expectRejection(
        _.assign({}, goodObject, {time: new Date('2014-01-01T01:01:00.000Z').valueOf()}), 'time', done
      );
    });
  });

  describe('timezoneOffset', function(){
    exports.okIfAbsent(goodObject, 'timezoneOffset');
    it('rejects non-numerical timezoneOffset', function(done){
      exports.expectRejection(_.assign({}, goodObject, {timezoneOffset: '+08:00'}), 'timezoneOffset', done);
    });

    it('accepts 0 as a valid timezoneOffset', function(done){
      exports.run(_.assign({}, goodObject, {timezoneOffset: 0}), function(err, val){
        if (Array.isArray(val)) {
          expect(val).length(1);
          val = val[0];
        }
        expect(val.timezoneOffset).equals(0);
        done(err);
      });      
    });
  });

  describe('conversionOffset', function(){
    exports.okIfAbsent(goodObject, 'conversionOffset');

    it('rejects non-numerical conversionOffset', function(done){
      exports.expectRejection(_.assign({}, goodObject, {conversionOffset: '-0500'}), 'conversionOffset', done);
    });

    it('accepts 0 as a valid conversionOffset', function(done){
      exports.run(_.assign({}, goodObject, {conversionOffset: 0}), function(err, val){
        if (Array.isArray(val)) {
          expect(val).length(1);
          val = val[0];
        }
        expect(val.conversionOffset).equals(0);
        done(err);
      });      
    });
  });

  describe('clockDriftOffset', function(){
    exports.okIfAbsent(goodObject, 'clockDriftOffset');

    it('rejects non-numerical clockDriftOffset', function(done){
      exports.expectRejection(_.assign({}, goodObject, {clockDriftOffset: '-123456'}), 'clockDriftOffset', done);
    });

    it('accepts 0 as a valid clockDriftOffset', function(done){
      exports.run(_.assign({}, goodObject, {clockDriftOffset: 0}), function(err, val){
        if (Array.isArray(val)) {
          expect(val).length(1);
          val = val[0];
        }
        expect(val.clockDriftOffset).equals(0);
        done(err);
      });      
    });
  });

  describe('deviceId', function(){
    exports.rejectIfAbsent(goodObject, 'deviceId');
    it('rejects non-string deviceId', function(done){
      exports.expectRejection(_.assign({}, goodObject, {deviceId: 1337}), 'deviceId', done);
    });
  });

  describe('uploadId', function(){
    exports.rejectIfAbsent(goodObject, 'uploadId');
    it('rejects non-string uploadId', function(done){
      exports.expectRejection(_.assign({}, goodObject, {uploadId: 1337}), 'uploadId', done);
    });
  });

  describe('_active', function(){
    exports.okIfAbsent(goodObject, '_active');

    it('rejects data with _active set', function(done){
      exports.expectRejection(_.assign({}, goodObject, {_active: true}), '_active', done);
    });
  });

  describe('_version', function(){
    exports.okIfAbsent(goodObject, '_version');

    it('rejects data with _version set', function(done){
      exports.expectRejection(_.assign({}, goodObject, {_version: 2}), '_version', done);
    });
  });

  describe('_schemaVersion', function(){
    exports.okIfAbsent(goodObject, '_schemaVersion');

    it('rejects data with _schemaVersion set', function(done){
      exports.expectRejection(_.assign({}, goodObject, {_schemaVersion: 2}), '_schemaVersion', done);
    });
  });
};

