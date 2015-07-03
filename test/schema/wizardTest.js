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

//the incoming raw object, i.e. posted to the the API, that
//has not yet been validated or had any transformations applied
var incomingObject = {
  type: 'wizard',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  uploadId: 'test',
  recommended: {
    carb: 4.0,
    correction: 1.0,
    net: 4.0
  },
  carbInput: 45,
  bgInput: 6.2,
  insulinOnBoard: 1.3,
  bgTarget: { high: 6.0, low: 4.0 },
  payload: { howdy: 'bob' },
  bolus: {
    type: 'bolus',
    subType: 'injected',
    time: '2014-01-01T01:00:00.000Z',
    deviceId: 'test'
  },
  originUnits: 'mg/dl',
  _groupId: 'g'
};

describe('schema/wizard.js', function(){

  describe('bgInput', function(){
    helper.okIfAbsent(incomingObject, 'bgInput');
    helper.expectNumericalField(incomingObject, 'bgInput');
    helper.expectUnitConversion(incomingObject, 'bgInput');

    it('converts units', function(done){
      var localGood = _.assign({}, incomingObject, { bgInput: 100, });
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
      var localGood = _.assign({}, _.omit(incomingObject, 'bgInput'));
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
    helper.okIfAbsent(incomingObject, 'bgTarget');
    helper.expectObjectField(incomingObject, 'bgTarget');

    it('is ok if it is absent and units need conversion', function(done){
      helper.run(_.assign({}, _.omit(incomingObject, 'bgTarget')), function(err, converted) {
        expect(converted.bgTarget).not.to.equal(null);
        done();
      });
    });

    describe('(Target) + High/Low', function(){
      var localGood = {};
      beforeEach(function(){
        localGood = _.cloneDeep(incomingObject);
      });

      it('accepts a bgTarget with a target', function(done){
        localGood.bgTarget.target = 4.5;
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.originUnits = 'mg/dL';
        localGood.bgTarget = { low: 80, high: 100, target: 90 };

        helper.run(localGood, function(err, converted) {
          if (err != null) {
            return done(err);
          }
          expect(converted.units).to.equal('mmol/L');
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
        localGood = _.cloneDeep(incomingObject);
        localGood.originUnits = 'mmol/L';
        localGood.bgTarget = { target: 4.5, range: 0.5 };
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.originUnits = 'mg/dL';
        localGood.bgTarget = { target: 80, range: 10 };

        helper.run(localGood, function(err, converted) {
          expect(converted.units).to.equal('mmol/L');
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
        localGood = _.cloneDeep(incomingObject);
        localGood.bgTarget = { target: 4.5, high: 6.0 };
      });

      it('accepts the good', function(done){
        helper.run(localGood, done);
      });

      it('converts units', function(done){
        localGood.bgTarget = { target: 100, high: 140 };

        helper.run(localGood, function(err, converted) {
          expect(converted.units).to.equal('mmol/L');
          expect(converted.bgTarget).deep.equals(
              { target: 5.550747991045533, high: 7.771047187463747 }
          );
          done(err);
        });
      });
    });
  });

  describe('bolus', function(){
    helper.okIfAbsent(incomingObject, 'bolus');
    helper.expectNotNumberField(incomingObject, 'bolus');
  });

  describe('carbInput', function(){
    helper.okIfAbsent(incomingObject, 'carbInput');
    helper.expectNumericalField(incomingObject, 'carbInput');
  });

  describe('insulinCarbRatio', function(){
    helper.okIfAbsent(incomingObject, 'insulinCarbRatio');
    helper.expectNumericalField(incomingObject, 'insulinCarbRatio');
  });

  describe('insulinOnBoard', function(){
    helper.okIfAbsent(incomingObject, 'insulinOnBoard');
    helper.expectNumericalField(incomingObject, 'insulinOnBoard');
  });

  describe('insulinSensitivity', function(){
    var localGood = {};

    beforeEach(function(){
      localGood = _.cloneDeep(incomingObject);
    });

    helper.okIfAbsent(incomingObject, 'insulinSensitivity');
    helper.expectNumericalField(incomingObject, 'insulinSensitivity');

    it('converts units', function(done){
      var localGood = _.assign({}, incomingObject, { insulinSensitivity: 50, originUnits : 'mg/dL' });
      console.log('before conversion ',localGood);
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.units).to.equal('mmol/L');
        console.log('converted ',converted);
        expect(converted.insulinSensitivity).to.equal(2.7753739955227665);
        done();
      });
    });

    it('does not produce an NaN value if it is absent and units need conversion', function(done){
      var localGood = _.assign({}, _.omit(incomingObject, 'insulinSensitivity'));
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
    helper.okIfAbsent(incomingObject, 'payload');
    helper.expectObjectField(incomingObject, 'payload');
  });

  describe('recommended', function(){
    helper.okIfAbsent(incomingObject, 'recommended');
    helper.expectObjectField(incomingObject, 'recommended');

    it('carb is a numeric field', function(done){
      var obj = _.cloneDeep(incomingObject);
      obj.recommended.carb = '1';
      helper.expectRejection(obj, 'recommended', done);
    });
    it('correction is a numeric field', function(done){
      var obj = _.cloneDeep(incomingObject);
      obj.recommended.correction = '2';
      helper.expectRejection(obj, 'recommended', done);
    });
    it('net is a numeric field', function(done){
      var obj = _.cloneDeep(incomingObject);
      obj.recommended.net = '3';
      helper.expectRejection(obj, 'recommended', done);
    });
  });

  describe('units', function(){
    helper.rejectIfAbsent(incomingObject, 'units');
    helper.expectStringField(incomingObject, 'units');
    helper.expectFieldIn(incomingObject, 'units',
      ['mmol/L', 'mmol/l'],
      ['mmol/L', 'mmol/L']);
  });

  helper.testCommonFields(incomingObject);
});