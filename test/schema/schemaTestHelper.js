/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var mockableObject = salinity.mockableObject;

exports.streamDAO = mockableObject.make('getDatum');
exports.schema = require('../../lib/schema')(exports.streamDAO);

exports.resetMocks = function(){
  mockableObject.reset(exports.streamDAO);
};

exports.run = function(datum, cb) {
  return exports.schema[datum.type](datum, cb);
};

exports.expectRejection = function(object, field, cb) {
  exports.run(object, function(err){
    expect(err).to.exist;
    expect(err.statusCode).equals(400);
    expect(err.message).to.match(new RegExp(field));
    cb();
  });
};

exports.rejectIfAbsent = function(goodObject, field) {
  it(util.format('rejects if field[%s] is not present', field), function(done){
    exports.expectRejection(_.omit(goodObject, field), field, done);
  });
};

exports.okIfAbsent = function(goodObject, field) {
  it(util.format('allows the field[%s] to be absent', field), function(done){
    exports.run(_.omit(goodObject, field), done);
  });
};

exports.expectStringField = function(goodObject, field) {
  it('rejects numerical value', function(done){
    var toAdjust = {};
    toAdjust[field] = 1;
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });

  it('rejects object value', function(done){
    var toAdjust = {};
    toAdjust[field] = { howdy: 'honda' };
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.expectNumericalField = function(goodObject, field) {
  it('rejects string value', function(done){
    var toAdjust = {};
    toAdjust[field] = '1';
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });

  it('rejects object value', function(done){
    var toAdjust = {};
    toAdjust[field] = { howdy: 'honda' };
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.expectObjectField = function(goodObject, field) {
  it('rejects string value', function(done){
    var toAdjust = {};
    toAdjust[field] = '1';
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });

  it('rejects numerical value', function(done){
    var toAdjust = {};
    toAdjust[field] = 1;
    exports.expectRejection(_.assign({}, goodObject, toAdjust), field, done);
  });
};

exports.testCommonFields = function(goodObject) {
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
    it('rejects timezoneOffset < -1440', function(done){
      exports.expectRejection(_.assign({}, goodObject, {timezoneOffset: -1441}), 'timezoneOffset', done);
    });
    it('rejects timezoneOffset > 1440', function(done){
      exports.expectRejection(_.assign({}, goodObject, {timezoneOffset: 1441}), 'timezoneOffset', done);
    });
  });

  describe('deviceId', function(){
    exports.rejectIfAbsent(goodObject, 'deviceId');
    it('rejects non-string deviceId', function(done){
      exports.expectRejection(_.assign({}, goodObject, {deviceId: 1337}), 'deviceId', done);
    });
  });

  describe('source', function(){
    exports.rejectIfAbsent(goodObject, 'source');
    it('rejects non-string source', function(done){
      exports.expectRejection(_.assign({}, goodObject, {source: 1337}), 'source', done);
    });
  });
};

