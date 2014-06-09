/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'settings',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  "activeSchedule": "standard",
  "units": {
    "carb": "grams",
    "bg": "mmol/L"
  },
  "basalSchedules": {
    "standard": [
      { "rate": 0.8, "start": 0 },
      { "rate": 0.75, "start": 3600000 }
    ],
    "pattern a": [
      { "rate": 0.95, "start": 0 },
      { "rate": 0.9, "start": 3600000 }
    ]
  },
  "carbRatio": [
    { "amount": 12, "start": 0 },
    { "amount": 10, "start": 21600000 }
  ],
  "insulinSensitivity": [
    { "amount": 3.6, "start": 0 },
    { "amount": 2.5, "start": 18000000 }
  ],
  "bgTarget": [
    { "low": 5.5, "high": 6.7, "start": 0 },
    { "low": 5, "high": 6.1, "start": 18000000 }
  ],
  _groupId: 'g'
};

describe('schema/settings.js', function () {
  describe('activeSchedule', function () {
    helper.rejectIfAbsent(goodObject, 'activeSchedule');
    helper.expectStringField(goodObject, 'activeSchedule');
  });

  describe('units', function () {
    helper.rejectIfAbsent(goodObject, 'units');
    helper.expectObjectField(goodObject, 'units');
  });

  describe('basalSchedules', function () {
    helper.rejectIfAbsent(goodObject, 'basalSchedules');
    helper.expectObjectField(goodObject, 'basalSchedules');

    it('rejects a schedule with a negative start', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.basalSchedules.standard[0].start = -1;
      helper.expectRejection(localGood, 'basalSchedules', done);
    });

    it('accepts a schedule with a start of 23:59:59.999', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.basalSchedules.standard[1].start = (24 * 60 * 60 * 1000) - 1;
      helper.run(localGood, done);
    });

    it('rejects a schedule with a start of 24 hours', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.basalSchedules.standard[1].start = (24 * 60 * 60 * 1000);
      helper.expectRejection(localGood, 'basalSchedules', done);
    });
  });

  describe('carbRatio', function () {
    helper.rejectIfAbsent(goodObject, 'carbRatio');
    helper.expectObjectField(goodObject, 'carbRatio');

    it('rejects a schedule with a negative start', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.carbRatio[0].start = -1;
      helper.expectRejection(localGood, 'carbRatio', done);
    });

    it('accepts a schedule with a start of 23:59:59.999', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.carbRatio[1].start = (24 * 60 * 60 * 1000) - 1;
      helper.run(localGood, done);
    });

    it('rejects a schedule with a start of 24 hours', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.carbRatio[1].start = (24 * 60 * 60 * 1000);
      helper.expectRejection(localGood, 'carbRatio', done);
    });
  });

  describe('insulinSensitivity', function () {
    helper.rejectIfAbsent(goodObject, 'insulinSensitivity');
    helper.expectObjectField(goodObject, 'insulinSensitivity');

    it('rejects a schedule with a negative start', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.insulinSensitivity[0].start = -1;
      helper.expectRejection(localGood, 'insulinSensitivity', done);
    });

    it('accepts a schedule with a start of 23:59:59.999', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.insulinSensitivity[1].start = (24 * 60 * 60 * 1000) - 1;
      helper.run(localGood, done);
    });

    it('rejects a schedule with a start of 24 hours', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.insulinSensitivity[1].start = (24 * 60 * 60 * 1000);
      helper.expectRejection(localGood, 'insulinSensitivity', done);
    });

    it('converts units', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.units.bg = 'mg/dL';
      localGood.insulinSensitivity[0].amount = 35;
      localGood.insulinSensitivity[1].amount = 50;

      helper.run(localGood, function(err, converted) {
        expect(converted.insulinSensitivity[0].amount).equals(1.9427617968659368);
        expect(converted.insulinSensitivity[1].amount).equals(2.7753739955227665);
        done(err);
      });
    });
  });

  describe('bgTarget', function () {
    helper.rejectIfAbsent(goodObject, 'bgTarget');
    helper.expectObjectField(goodObject, 'bgTarget');

    it('rejects a schedule with a negative start', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.bgTarget[0].start = -1;
      helper.expectRejection(localGood, 'bgTarget', done);
    });

    it('accepts a schedule with a start of 23:59:59.999', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.bgTarget[1].start = (24 * 60 * 60 * 1000) - 1;
      helper.run(localGood, done);
    });

    it('rejects a schedule with a start of 24 hours', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.bgTarget[1].start = (24 * 60 * 60 * 1000);
      helper.expectRejection(localGood, 'bgTarget', done);
    });

    it('converts units', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.units.bg = 'mg/dL';
      localGood.bgTarget[0].low = 80;
      localGood.bgTarget[0].high = 100;

      localGood.bgTarget[1].low = 90;
      localGood.bgTarget[1].high = 110;

      helper.run(localGood, function(err, converted) {
        expect(converted.bgTarget[0].low).equals(4.440598392836427);
        expect(converted.bgTarget[0].high).equals(5.550747991045533);
        expect(converted.bgTarget[1].low).equals(4.9956731919409805);
        expect(converted.bgTarget[1].high).equals(6.1058227901500866);
        done(err);
      });
    });
  });

  helper.testCommonFields(goodObject);
});