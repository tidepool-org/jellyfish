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

var goodObject = {
  type: 'insulin',
  time: '2020-10-01T01:00:00.000Z',
  deviceTime: '2020-10-01T01:00:00',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
  dose: {
    total: 101.1,
    units: 'Units'
  },
  payload: { howdy: 'bob' },
  _userId: 'u',
  _groupId: 'g'
};

describe('schema/insulin.js', function () {
  it('dose', function (done) {
    var localGood = _.cloneDeep(goodObject);
    helper.rejectIfAbsent(localGood, 'dose');
    helper.expectObjectField(localGood, 'dose');
    helper.rejectIfAbsent(localGood.dose, 'total');
    helper.expectNumericalField(localGood.dose, 'total');
    helper.rejectIfAbsent(localGood.dose, 'units');
    helper.expectStringField(localGood.dose, 'units');
    helper.expectFieldIn(localGood.dose, 'units', ['Units']);
    done();
  });

  it('reject invalid high dose value', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.dose.total = 1001;
    helper.expectRejection(localGood, 'dose', done);
  });

  it('accepts max dose value', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.dose.total= 250;
    helper.run(localGood, done);
  });

  it('reject invalid low dose value', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.dose.total = -1;
    helper.expectRejection(localGood, 'dose', done);
  });

  it('accepts min dose value', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.dose.total = 0;
    helper.run(localGood, done);
  });

  it('reject invalid dose unit', function (done) {
    var localGood = _.cloneDeep(goodObject);
    localGood.dose.units = 'mg/dL';
    helper.expectRejection(localGood, 'dose', done);
  });

  helper.testCommonFields(goodObject);
});
