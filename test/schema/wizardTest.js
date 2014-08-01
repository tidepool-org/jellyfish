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
  recommended: 5.0,
  carbInput: 45,
  bgInput: 6.2,
  activeInsulin: 1.3,
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
    helper.expectNumericalField(goodObject, 'recommended');
  });

  describe('carbInput', function(){
    helper.okIfAbsent(goodObject, 'carbInput');
    helper.expectNumericalField(goodObject, 'carbInput');
  });

  describe('bgInput', function(){
    helper.okIfAbsent(goodObject, 'bgInput');
    helper.expectNumericalField(goodObject, 'bgInput');
    helper.expectUnitConversion(goodObject, 'bgInput');
  });

  describe('activeInsulin', function(){
    helper.okIfAbsent(goodObject, 'activeInsulin');
    helper.expectNumericalField(goodObject, 'activeInsulin');
  });

  describe('payload', function(){
    helper.okIfAbsent(goodObject, 'payload');
    helper.expectObjectField(goodObject, 'payload');
  });

  describe('bolus', function(){
    helper.okIfAbsent(goodObject, 'bolus');
    helper.expectNotNumberField(goodObject, 'bolus');
  });

  helper.testCommonFields(goodObject);
});