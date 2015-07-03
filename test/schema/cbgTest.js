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

var incomingObject = {
  type: 'cbg',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  uploadId: 'test',
  value: 1.12,
  isig: 24.37,
  originUnits: 'mmol/L',
  _groupId: 'g'
};

describe('schema/cbg.js', function(){
  describe('value', function(){
    helper.rejectIfAbsent(incomingObject, 'value');
    helper.expectNumericalField(incomingObject, 'value');
    helper.expectUnitConversion(incomingObject, 'value');
  });

  describe('isig', function(){
    helper.okIfAbsent(incomingObject, 'isig');
    helper.expectNumericalField(incomingObject, 'isig');
  });

  describe('originUnits', function(){
    helper.rejectIfAbsent(incomingObject, 'originUnits');
    helper.expectStringField(incomingObject, 'originUnits');
  });

  describe('units', function(){
    var localIncoming = _.cloneDeep(incomingObject);

    helper.run(localIncoming, function(err, converted) {
      //occurs after conversion
      expect(converted.units).to.equal('mmol/L');
      expect(converted.value).to.equal(1.12);
    });
  });

  helper.testCommonFields(incomingObject);
});