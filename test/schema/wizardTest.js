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
var schema = require('../../lib/schema')(exports.streamDAO);

var goodObject = {
  type: 'wizard',
  deviceTime: '2014-01-01T03:00:00',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
  recommended: {
    carb: 4.0,
    correction: 1.0,
    net: 4.0
  },
  carbInput: 45,
  bgInput: 100,
  insulinOnBoard: 1.3,
  insulinSensitivity: 75,
  bgTarget: { high: 120, low: 80 },
  payload: { howdy: 'bob' },
  bolus: {
    type: 'bolus',
    subType: 'injected',
    time: '2014-01-01T01:00:00.000Z',
    deviceId: 'test'
  },
  units: 'mg/dL',
  _groupId: 'g'
};

describe('schema/wizard.js', function(){

  describe('bgInput', function(){
    helper.okIfAbsent(goodObject, 'bgInput');
    helper.expectNumericalField(goodObject, 'bgInput');
    helper.expectUnitConversion(goodObject, 'bgInput');

    it('converts units', function(done){
      var localGood = _.assign({}, goodObject, { bgInput: 100 });
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.units).to.equal('mmol/L');
        expect(converted.bgInput).to.equal(5.550747991045533);
        done();
      });
    });

    it('does not produce an NaN value if it is absent and units need conversion', function(done){
      var localGood = _.assign({}, _.omit(goodObject, 'bgInput'));
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.bgInput).not.to.exist;
        done();
      });
    });
  });

  describe('bgTarget', function () {
    helper.okIfAbsent(goodObject, 'bgTarget');
    helper.expectObjectField(goodObject, 'bgTarget');

    it('is ok if it is absent and units need conversion', function(done){
      helper.run(_.assign({}, _.omit(goodObject, 'bgTarget')), function(err, converted) {
        expect(converted.bgTarget).not.to.equal(null);
        done();
      });
    });

    describe('(Target) + High/Low', function(){
      var localGood = {};
      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
      });

      it('accepts a bgTarget with a target', function(done){
        localGood.bgTarget.target = 4.5;
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.units = 'mg/dL';
        localGood.bgTarget = { low: 80, high: 100, target: 90 };

        helper.run(localGood, function(err, converted) {
          if (err != null) {
            return done(err);
          }

          expect(converted.bgTarget).deep.equals(
            { low: 4.440598392836427, high: 5.550747991045533, target: 4.9956731919409805 }
          );
          done();
        });
      });
    });

    describe('Target + Range', function(){
      var localGood = {};

      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
        localGood.bgTarget = { target: 4.5, range: 0.5 };
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.bgTarget = { target: 80, range: 10 };

        helper.run(localGood, function(err, converted) {
          expect(converted.bgTarget).deep.equals(
            { target: 4.440598392836427, range: 0.5550747991045534 }
          );
          done(err);
        });
      });
    });

    describe('Target + High', function(){
      var localGood = {};

      beforeEach(function(){
        localGood = _.cloneDeep(goodObject);
        localGood.bgTarget = { target: 4.5, high: 6.0 };
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.bgTarget = { target: 100, high: 140 };

        helper.run(localGood, function(err, converted) {
          expect(converted.bgTarget).deep.equals(
              { target: 5.550747991045533, high: 7.771047187463747 }
          );
          done(err);
        });
      });
    });
  });

  describe('bolus', function(){
    helper.okIfAbsent(goodObject, 'bolus');
    helper.expectNotNumberField(goodObject, 'bolus');
  });

  describe('carbInput', function(){
    helper.okIfAbsent(goodObject, 'carbInput');
    helper.expectNumericalField(goodObject, 'carbInput');
  });

  describe('insulinCarbRatio', function(){
    helper.okIfAbsent(goodObject, 'insulinCarbRatio');
    helper.expectNumericalField(goodObject, 'insulinCarbRatio');
  });

  describe('insulinOnBoard', function(){
    helper.okIfAbsent(goodObject, 'insulinOnBoard');
    helper.expectNumericalField(goodObject, 'insulinOnBoard');
  });

  describe('insulinSensitivity', function(){
    helper.okIfAbsent(goodObject, 'insulinSensitivity');
    helper.expectNumericalField(goodObject, 'insulinSensitivity');

    it('converts units', function(done){
      var localGood = _.assign({}, goodObject, { insulinSensitivity: 50 });
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.units).to.equal('mmol/L');
        expect(converted.insulinSensitivity).to.equal(2.7753739955227665);
        done();
      });
    });

    it('does not produce an NaN value if it is absent and units need conversion', function(done){
      var localGood = _.assign({}, _.omit(goodObject, 'insulinSensitivity'));
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.insulinSensitivity).not.to.exist;
        done();
      });
    });
  });

  describe('payload', function(){
    helper.okIfAbsent(goodObject, 'payload');
    helper.expectObjectField(goodObject, 'payload');
  });

  describe('recommended', function(){
    helper.okIfAbsent(goodObject, 'recommended');
    helper.expectObjectField(goodObject, 'recommended');

    it('carb is a numeric field', function(done){
      var obj = _.cloneDeep(goodObject);
      obj.recommended.carb = '1';
      helper.expectRejection(obj, 'recommended', done);
    });
    it('correction is a numeric field', function(done){
      var obj = _.cloneDeep(goodObject);
      obj.recommended.correction = '2';
      helper.expectRejection(obj, 'recommended', done);
    });
    it('net is a numeric field', function(done){
      var obj = _.cloneDeep(goodObject);
      obj.recommended.net = '3';
      helper.expectRejection(obj, 'recommended', done);
    });
  });

  describe('units', function(){
    helper.rejectIfAbsent(goodObject, 'units');
    helper.expectStringField(goodObject, 'units');
    helper.expectFieldIn(goodObject, 'units',
      ['mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'],
      ['mmol/L', 'mmol/L', 'mmol/L', 'mmol/L']);
  });

  helper.testCommonFields(goodObject);
});