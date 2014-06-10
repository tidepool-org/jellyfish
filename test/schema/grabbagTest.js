/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'grabbag',
  subType: 'something',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  value: 1.12,
  isig: 24.37,
  _groupId: 'g'
};

describe('schema/grabbag.js', function(){
  describe('subType', function(){
    helper.rejectIfAbsent(goodObject, 'subType');
    helper.expectStringField(goodObject, 'subType');
  });

  helper.testCommonFields(goodObject);
});