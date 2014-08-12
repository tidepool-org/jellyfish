/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'wizard',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  recommended: {
    carb: 4.0,
    correction: 1.0
  },
  carbInput: 45,
  bgInput: 6.2,
  activeInsulin: 1.3,
  bgTarget: { high: 6.0, low: 4.0 },
  payload: { howdy: 'bob' },
  bolus: {
    type: 'bolus',
    subType: 'injected',
    time: '2014-01-01T01:00:00.000Z',
    deviceId: 'test'
  },
  _groupId: 'g'
};

describe('schema/wizard.js', function(){
  describe('recommended', function(){
    helper.rejectIfAbsent(goodObject, 'recommended');
    helper.expectObjectField(goodObject, 'recommended');
  });

  describe('carbInput', function(){
    helper.okIfAbsent(goodObject, 'carbInput');
    helper.expectNumericalField(goodObject, 'carbInput');
  });

  describe('bgInput', function(){
    helper.okIfAbsent(goodObject, 'bgInput');
    helper.expectNumericalField(goodObject, 'bgInput');
    helper.expectUnitConversion(goodObject, 'bgInput');

    it("converts units", function(done){
      var localGood = _.assign({}, goodObject, { bgInput: 100, units: 'mg/dl' });
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.units).to.equal('mg/dL');
        expect(converted.bgInput).to.equal(5.550747991045533);
        done();
      })
    });
  });

  describe('insulinOnBoard', function(){
    helper.okIfAbsent(goodObject, 'insulinOnBoard');
    helper.expectNumericalField(goodObject, 'insulinOnBoard');
  });

  describe('insulinCarbRatio', function(){
    helper.okIfAbsent(goodObject, 'insulinCarbRatio');
    helper.expectNumericalField(goodObject, 'insulinCarbRatio');
  });

  describe('insulinSensitivity', function(){
    helper.okIfAbsent(goodObject, 'insulinSensitivity');
    helper.expectNumericalField(goodObject, 'insulinSensitivity');
  });

  describe('bgInput', function(){
    helper.okIfAbsent(goodObject, 'bgInput');
    helper.expectNumericalField(goodObject, 'bgInput');
    helper.expectUnitConversion(goodObject, 'bgInput');

    it("converts units", function(done){
      var localGood = _.assign({}, goodObject, { bgInput: 100, units: 'mg/dl' });
      helper.run(localGood, function(err, converted){
        if (err != null) {
          return done(err);
        }

        expect(converted.units).to.equal('mg/dL');
        expect(converted.bgInput).to.equal(5.550747991045533);
        done();
      })
    });
  });

  describe('payload', function(){
    helper.okIfAbsent(goodObject, 'payload');
    helper.expectObjectField(goodObject, 'payload');
  });

  describe('bolus', function(){
    helper.okIfAbsent(goodObject, 'bolus');
    helper.expectNotNumberField(goodObject, 'bolus');
  });

  describe('bgTarget', function () {
    helper.okIfAbsent(goodObject, 'bgTarget');
    helper.expectObjectField(goodObject, 'bgTarget');

    it('is ok if it is absent and units need conversion', function(done){
      helper.run(_.assign(_.omit(goodObject, 'bgTarget'), {units: 'mg/dL'}), done);
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
        localGood.units = 'mg/dL';
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
        localGood.units = 'mg/dL';
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

  helper.testCommonFields(goodObject);
});