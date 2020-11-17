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
  type: 'reportedState',
  time: '2020-10-01T01:00:00.000Z',
  deviceTime: '2020-10-01T01:00:00',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
  states: [
    {
      state: 'illness'
    }
  ],
  payload: { howdy: 'bob' },
  _userId: 'u',
  _groupId: 'g'
};

describe('schema/reportedState.js', function () {
  it('states', function (done) {
    var localGood = _.cloneDeep(goodObject);
    helper.rejectIfAbsent(localGood, 'states');
    helper.expectObjectField(localGood, 'states[0]');
    helper.rejectIfAbsent(localGood.states[0], 'state');
    helper.expectStringField(localGood.states[0], 'state');
    helper.expectFieldIn(localGood.states[0], 'state',
      ['alcohol', 'cycle', 'hyperglycemiaSymptoms', 'hypoGlycemiaSymptioms', 'illness', 'stress', 'other']);
    done();
  });

  it('states is an array', function(done) {
    var obj = _.cloneDeep(goodObject);
    obj.states = 1;
    helper.expectRejection(obj, 'states', done);
  });

  it('states does not accept any old string values', function(done) {
    var obj = _.cloneDeep(goodObject);
    obj.states = ['foo', 'bar'];
    helper.expectRejection(obj, 'states', done);
  });

  it('reject if state is not a string', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.states[0].state = 1;
    helper.expectRejection(localGood, 'state', done);
  });

  it('reject invalid state', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.states[0].state = 'foo';
    helper.expectRejection(localGood, 'state', done);
  });

  it('reject other state without stateOther', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.states[0].state = 'other';
    helper.expectRejection(localGood, 'state', done);
  });

  helper.testCommonFields(goodObject);
});
