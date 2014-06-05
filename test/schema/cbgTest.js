/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var expect = require('salinity').expect;

var schema = require('../../lib/schema');

function run(datum, cb) {
  return schema[datum.type](datum, cb);
}

function expectRejection(object, field, cb) {
  run(object, function(err){
    expect(err).to.exist;
    expect(err.statusCode).equals(400);
    expect(err.message).to.match(new RegExp(field));
    cb();
  });
}

function rejectIfAbsent(field) {
  it(util.format('rejects if field %s is not present', field), function(done){
    expectRejection(_.omit(goodObject, field), field, done);
  });
}

function okIfAbsent(field) {
  it(util.format('allows the field %s to be absent', field), function(done){
    run(_.omit(goodObject, field), done);
  });
}

var goodObject = {
  type: 'cbg',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  value: 1.12,
  isig: 24.37
};

describe('schema/cbg.js', function(){
  describe('value', function(){
    rejectIfAbsent('value');
    it('rejects non-numerical value', function(done){
      expectRejection(_.assign({}, goodObject, {value: '1'}), 'value', done);
    });

    it('converts units from mg/dL to mmol/L', function(done){
      run(_.assign({}, goodObject, {value: 80, units: 'mg/dL'}), function(err, val){
        expect(val.units).equals('mg/dL');
        expect(val.value).equals(4.440598392836427);
        done(err);
      });
    });

    it('converts units from mg/dl to mmol/L', function(done){
      run(_.assign({}, goodObject, {value: 80, units: 'mg/dl'}), function(err, val){
        expect(val.units).equals('mg/dL');
        expect(val.value).equals(4.440598392836427);
        done(err);
      });
    });
  });

  describe('isig', function(){
    okIfAbsent('isig');
    it('rejects non-numerical isig', function(done){
      expectRejection(_.assign({}, goodObject, {isig: '1'}), 'isig', done);
    });
  });

  describe('time', function(){
    rejectIfAbsent('time');

    it('accepts timestamps in non-Zulu time and converts them', function(done){
      run(_.assign({}, goodObject, {time: '2014-01-01T01:00:00.000-03:15'}), function(err, val){
        expect(val.time).equals('2014-01-01T04:15:00.000Z');
        done(err);
      })
    });
    it('rejects timestamps without a timezone', function(done){
      expectRejection(_.assign({}, goodObject, {time: '2014-01-01'}), 'time', done);
    });
    it('rejects non-string time', function(done){
      expectRejection(_.assign({}, goodObject, {time: new Date('2014-01-01T01:01:00.000Z').valueOf()}), 'time', done);
    });
  });

  describe('timezoneOffset', function(){
    okIfAbsent('timezoneOffset');
    it('rejects non-numerical timezoneOffset', function(done){
      expectRejection(_.assign({}, goodObject, {timezoneOffset: '+08:00'}), 'timezoneOffset', done);
    });
    it('rejects timezoneOffset < -1440', function(done){
      expectRejection(_.assign({}, goodObject, {timezoneOffset: -1441}), 'timezoneOffset', done);
    });
    it('rejects timezoneOffset > 1440', function(done){
      expectRejection(_.assign({}, goodObject, {timezoneOffset: 1441}), 'timezoneOffset', done);
    });
  });

  describe('deviceId', function(){
    rejectIfAbsent('deviceId');
    it('rejects non-string deviceId', function(done){
      expectRejection(_.assign({}, goodObject, {deviceId: 1337}), 'deviceId', done);
    });
  });

  describe('source', function(){
    rejectIfAbsent('source');
    it('rejects non-string source', function(done){
      expectRejection(_.assign({}, goodObject, {source: 1337}), 'source', done);
    });
  });
});