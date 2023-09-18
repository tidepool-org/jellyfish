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
  type: 'pumpSettings',
  deviceTime: '2014-01-01T03:00:00',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
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
  _userId: 'u',
  _groupId: 'g'
};

describe('schema/pumpSettings.js', function () {
  describe('activeSchedule', function () {
    helper.rejectIfAbsent(goodObject, 'activeSchedule');
    helper.expectStringField(goodObject, 'activeSchedule');
  });

  describe('automatedDelivery', function () {
    it('rejects automatedDelivery that is not true/false', function(done){
      var localGood = _.cloneDeep(goodObject);
      localGood.automatedDelivery = 'wobble';
      helper.expectRejection(localGood, 'automatedDelivery', done);
    });
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
    helper.rejectIfNeither(goodObject, 'carbRatio', 'carbRatios');
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

  describe('carbRatios', function() {
    var multiCarbRatios = _.cloneDeep(goodObject);
    delete multiCarbRatios.carbRatio;
    multiCarbRatios.carbRatios = { "weekday": goodObject.carbRatio, "weekend": goodObject.carbRatio};

    helper.expectObjectField(multiCarbRatios, 'carbRatios');

    it('accepts carbRatios with multiple schedules', function(done) {
      helper.run(multiCarbRatios, done);
    });

    it('rejects carbRatios with bad internal schema', function(done) {
      var multiCarbRatioWrong = _.cloneDeep(goodObject);
      delete multiCarbRatioWrong.carbRatio;
      multiCarbRatioWrong.carbRatios = { "these": "are not the droids you're looking for" };
      helper.expectRejection(multiCarbRatioWrong, 'carbRatios', done);
    });
  });

  it('rejects with both carbRatio and carbRatios present', function(done) {
    var both = _.cloneDeep(goodObject);
    both.carbRatios = { "weekday": goodObject.carbRatio, "weekend": goodObject.carbRatio};
    helper.expectRejection(both, 'carbRatio', done);
  });

  describe('insulinSensitivity', function() {
    helper.rejectIfNeither(goodObject, 'insulinSensitivity', 'insulinSensitivities');
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
        expect(converted.insulinSensitivity[0].amount).equals(1.94277);
        expect(converted.insulinSensitivity[1].amount).equals(2.77538);
        done(err);
      });
    });
  });

  describe('insulinSensitivities', function() {
    var multiIS = _.cloneDeep(goodObject);
    delete multiIS.insulinSensitivity;
    multiIS.insulinSensitivities = { "weekday": goodObject.insulinSensitivity, "weekend": goodObject.insulinSensitivity };

    helper.expectObjectField(multiIS, 'insulinSensitivities');

    it('accepts with multiple schedules', function(done) {
      helper.run(multiIS, done);
    });

    it('rejects with bogus schema', function(done) {
      var bogusMultiIS = _.cloneDeep(multiIS);
      bogusMultiIS.insulinSensitivities = { "one": "does not simply walk into Mordor" };
      helper.expectRejection(bogusMultiIS, 'insulinSensitivities', done);
    });

    it('still converts units in multiple schedules', function(done) {
      var multiConvert = _.cloneDeep(multiIS);
      multiConvert.units.bg = 'mg/dL';
      multiConvert.insulinSensitivities = {
        "weekday": [  { "amount": 35, "start": 0 },
          { "amount": 35, "start": 18000000 }  ],
        "weekend": [ { "amount": 50, "start": 0 },
          { "amount": 50, "start": 18000000 } ]
        };
      helper.run(multiConvert, function(err, converted) {
        if (err != null) {
          return done(err);
        }
        expect(converted.insulinSensitivities.weekday[0].amount).equals(1.94277);
        expect(converted.insulinSensitivities.weekend[1].amount).equals(2.77538);
        done(err);
      });
    });
  });

  // Tandem
  describe('bgTargets', function() {
    var multiBgTargets = _.cloneDeep(goodObject);
    delete multiBgTargets.bgTarget;
    multiBgTargets.bgTargets = { "weekday": goodObject.bgTarget, "weekend": goodObject.bgTarget };

    helper.expectObjectField(multiBgTargets, 'bgTargets');

    it('accepts with multiple schedules', function(done) {
      helper.run(multiBgTargets, done);
    });

    it('rejects with bogus schema', function(done) {
      var bogusMultiBgTargets = _.cloneDeep(multiBgTargets);
      bogusMultiBgTargets.bgTargets = { "Y": "you no fix this bug" };
      helper.expectRejection(bogusMultiBgTargets, 'bgTargets', done);
    });

    it('still converts units with multiple schedules', function(done) {
      var multiConvert = _.cloneDeep(multiBgTargets);
      multiConvert.units.bg = 'mg/dL';
      multiConvert.bgTargets = {
        "weekday": [
          { target: 90, start: 0 },
          { target: 100, start: 10800000 }
        ],
        "weekend": [
          { target: 90, start: 0 },
          { target: 100, start: 21600000 }
        ]};
      helper.run(multiConvert, function(err, converted) {
        if (err != null) {
          return done(err);
        }
        expect(converted.bgTargets.weekend[0].target).equals(4.99568);
        done(err);
      });
    });
  });


  describe('bgTarget', function () {
    helper.rejectIfNeither(goodObject, 'bgTarget', 'bgTargets');
    helper.expectObjectField(goodObject, 'bgTarget');

    // Medtronic
    describe('(Target) + High/Low', function(){
      var localGood = {};
      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
      });

      it('rejects a bgTarget with a negative start', function(done){
        localGood.bgTarget[0].start = -1;
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('accepts a bgTarget with a start of 23:59:59.999', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000) - 1;
        helper.run(localGood, done);
      });

      it('rejects a bgTarget with a start of 24 hours', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000);
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('accepts a bgTarget with a target', function(done){
        localGood.bgTarget[1].target = 4.5;
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.units.bg = 'mg/dL';
        localGood.bgTarget = [
          { low: 80, high: 100, target: 90, start: 0 },
          { low: 90, high: 110, target: 100, start: 10800000 }
        ];

        helper.run(localGood, function(err, converted) {
          if (err != null) {
            return done(err);
          }

          expect(converted.bgTarget).deep.equals(
            [
              { low: 4.4406, high: 5.55075, target: 4.99568, start: 0 },
              { low: 4.99568, high: 6.10583, target: 5.55075, start: 10800000 }
            ]
          );
          done();
        });
      });
    });

    // Animas
    describe('Target + Range', function(){
      var localGood = {};

      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
        localGood.bgTarget = [
          { target: 4.5, range: 0.5, start: 0 },
          { target: 4.0, range: 0.5, start: 43200000 }
        ];
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('rejects a bgTarget with a negative start', function(done){
        localGood.bgTarget[0].start = -1;
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('accepts a bgTarget with a start of 23:59:59.999', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000) - 1;
        helper.run(localGood, done);
      });

      it('rejects a bgTarget with a start of 24 hours', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000);
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('converts units', function(done){
        localGood.units.bg = 'mg/dL';
        localGood.bgTarget = [
          { target: 80, range: 10 , start: 0 },
          { target: 90, range: 10 , start: 43200000 }
        ];

        helper.run(localGood, function(err, converted) {
          expect(converted.bgTarget).deep.equals(
            [
              { target: 4.4406, range: 0.55508, start: 0 },
              { target: 4.99568, range: 0.55508, start: 43200000 }
            ]
          );
          done(err);
        });
      });
    });

    // OmniPod
    describe('Target + High', function(){
      var localGood = {};

      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
        localGood.bgTarget = [
          { target: 4.5, high: 6.0, start: 0 },
          { target: 4.0, high: 5.0, start: 43200000 }
        ];
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('rejects a bgTarget with a negative start', function(done){
        localGood.bgTarget[0].start = -1;
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('accepts a bgTarget with a start of 23:59:59.999', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000) - 1;
        helper.run(localGood, done);
      });

      it('rejects a bgTarget with a start of 24 hours', function(done){
        localGood.bgTarget[1].start = (24 * 60 * 60 * 1000);
        helper.expectRejection(localGood, 'bgTarget', done);
      });

      it('converts units', function(done){
        localGood.units.bg = 'mg/dL';
        localGood.bgTarget = [
          { target: 100, high: 140, start: 0 },
          { target: 90, high: 110, start: 43200000 }
        ];

        helper.run(localGood, function(err, converted) {
          expect(converted.bgTarget).deep.equals(
            [
              { target: 5.55075, high: 7.77105, start: 0 },
              { target: 4.99568, high: 6.10583, start: 43200000 }
            ]
          );
          done(err);
        });
      });
    });
  });

  helper.testCommonFields(goodObject);
});
