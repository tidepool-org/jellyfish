/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'food',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  carbs: 73,
  _groupId: 'g'
};

describe('schema/food.js', function(){
  describe('carbs', function(){
    helper.rejectIfAbsent(goodObject, 'carbs');
    helper.expectNumericalField(goodObject, 'carbs');

  });

  helper.testCommonFields(goodObject);
});