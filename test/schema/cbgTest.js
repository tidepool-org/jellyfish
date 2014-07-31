/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'cbg',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  value: 1.12,
  isig: 24.37,
  _groupId: 'g'
};

describe('schema/cbg.js', function(){
  describe('value', function(){
    helper.rejectIfAbsent(goodObject, 'value');
    helper.expectNumericalField(goodObject, 'value');
    helper.expectUnitConversion(goodObject, 'value');
  });

  describe('isig', function(){
    helper.okIfAbsent(goodObject, 'isig');
    helper.expectNumericalField(goodObject, 'isig');
  });

  helper.testCommonFields(goodObject);
});