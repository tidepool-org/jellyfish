/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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
  type: 'physicalActivity',
  time: '2020-10-01T01:00:00.000Z',
  deviceTime: '2020-10-01T01:00:00',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
  duration: {
    value: 30,
    units: 'minutes'
  },
  payload: { howdy: 'bob' },
  _userId: 'u',
  _groupId: 'g'
};

describe('schema/physicalActivity.js', function () {
  it('duration', function (done) {
    var localGood = _.cloneDeep(goodObject);
    helper.rejectIfAbsent(localGood, 'duration');
    helper.expectObjectField(localGood, 'duration');
    helper.rejectIfAbsent(localGood.duration, 'value');
    helper.expectNumericalField(localGood.duration, 'value');
    helper.rejectIfAbsent(localGood.duration, 'units');
    helper.expectStringField(localGood.duration, 'units');
    helper.expectFieldIn(localGood.duration, 'units', ['minutes', 'hours', 'seconds']);
    done();
  });

  it('reject invalid duration unit', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.duration.units = 'parsecs';
    helper.expectRejection(localGood, 'duration', done);
  });

  it('reject invalid time in seconds', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.duration.units = 'seconds';
    localGood.duration.value = 999999;
    helper.expectRejection(localGood, 'duration', done);
  });

  it('reject invalid time in minutes', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.duration.units = 'minutes';
    localGood.duration.value = 999999;
    helper.expectRejection(localGood, 'duration', done);
  });

  it('reject invalid time in hours', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.duration.units = 'hours';
    localGood.duration.value = 999;
    helper.expectRejection(localGood, 'duration', done);
  });

  helper.testCommonFields(goodObject);
});
