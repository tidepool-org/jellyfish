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
  type: 'food',
  time: '2020-10-01T01:00:00.000Z',
  deviceTime: '2020-10-01T01:00:00',
  timezoneOffset: 120,
  conversionOffset: 0,
  deviceId: 'test',
  uploadId: 'test',
  nutrition: {
    carbohydrate: {
      net: 15.5,
      units: 'grams',
    },
  },
  name: 'Apple',
  payload: { howdy: 'bob' },
  _userId: 'u',
  _groupId: 'g'
};

describe('schema/food.js', function () {
  describe('nutrition', function () {
    helper.rejectIfAbsent(goodObject, 'nutrition');
    helper.expectObjectField(goodObject, 'nutrition');
    helper.okIfAbsent(goodObject, 'name');
    helper.expectStringField(goodObject, 'name');

    it('carbohydrate', function (done) {
      var localGood = _.cloneDeep(goodObject);
      helper.rejectIfAbsent(localGood, 'carbohydrate');
      helper.expectObjectField(localGood, 'carbohydrate');
      helper.rejectIfAbsent(localGood.carbohydrate, 'net');
      helper.expectNumericalField(localGood.carbohydrate, 'net');
      helper.rejectIfAbsent(localGood.carbohydrate, 'units');
      helper.expectStringField(localGood.carbohydrate, 'units');
      helper.expectFieldIn(localGood.carbohydrate, 'units', ['grams']);
      done();
    });

    it('reject invalid high carbohydrate value', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.nutrition.carbohydrate.net = 1001;
      helper.expectRejection(localGood, 'carbohydrate', done);
    });

    it('accepts max carbohydrate value', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.nutrition.carbohydrate.net = 1000;
      helper.run(localGood, done);
    });

    it('reject invalid low carbohydrate value', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.nutrition.carbohydrate.net = -1;
      helper.expectRejection(localGood, 'carbohydrate', done);
    });

    it('accepts min carbohydrate value', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.nutrition.carbohydrate.net = 0;
      helper.run(localGood, done);
    });

    it('reject invalid carbohydrate unit', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.nutrition.carbohydrate.units = 'oz';
      helper.expectRejection(localGood, 'carbohydrate', done);
    });
  });

  describe('name', function () {
    it('reject invalid name', function (done) {
      var localGood = _.cloneDeep(goodObject);
      localGood.name = 'this name is more than one hundred characters long, and should be rejected by the schema validator for sure';
      helper.expectRejection(localGood, 'name', done);
    });
  });

  helper.testCommonFields(goodObject);
});
