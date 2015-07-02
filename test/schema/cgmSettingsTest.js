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
  type: 'cgmSettings',
  time: '2015-06-16T13:09:10.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  uploadId: 'test',
  transmitterId: 'test',
  units: 'mg/dL',
  "highAlerts": {
      "enabled": true,
      "level": 8.3261219865683,
      "snooze": 0
  },
  "lowAlerts": {
      "enabled": true,
      "level": 3.6079861941795968,
      "snooze": 0
  },
  "outOfRangeAlerts": {
      "enabled": false,
      "snooze": 1800000
  },
  "rateOfChangeAlerts": {
      "fallRate": {
          "enabled": false,
          "rate": -0.16652243973136602
      },
      "riseRate": {
          "enabled": false,
          "rate": 0.16652243973136602
      }
  },
  _groupId: 'g'
};

/*
{
        "deviceId": "DexG4RecwitSha_SM51118608",
        "deviceTime": "2015-06-16T09:09:10",
        "guid": "0ba0f39d-6e21-4454-a6f0-ac2fb10c3a9b",
        "highAlerts": {
            "enabled": true,
            "level": 8.3261219865683,
            "snooze": 0
        },
        "id": "3t8f5h40i1245011ck8mtduledrftv2d",
        "lowAlerts": {
            "enabled": true,
            "level": 3.6079861941795968,
            "snooze": 0
        },
        "outOfRangeAlerts": {
            "enabled": false,
            "snooze": 1800000
        },
        "rateOfChangeAlerts": {
            "fallRate": {
                "enabled": false,
                "rate": -0.16652243973136602
            },
            "riseRate": {
                "enabled": false,
                "rate": 0.16652243973136602
            }
        },
        "time": "2015-06-16T13:09:10.000Z",
        "timezoneOffset": -240,
        "transmitterId": "68U6B",
        "type": "cgmSettings",
        "units": "mg/dL",
        "uploadId": "upid_4d6253eba395"
    }

*/

describe('schema/cgmSettings.js', function () {
  describe('transmitterId', function () {
    helper.rejectIfAbsent(goodObject, 'transmitterId');
    helper.expectStringField(goodObject, 'transmitterId');
  });
  describe('units', function () {
    helper.rejectIfAbsent(goodObject, 'units');
    helper.expectStringField(goodObject, 'units');
  });
  describe('highAlerts', function () {
    helper.rejectIfAbsent(goodObject, 'highAlerts');
    helper.expectObjectField(goodObject, 'highAlerts');

    it('fields', function(done){
      var localGood = _.cloneDeep(goodObject);
      helper.rejectIfAbsent(localGood.lowAlerts, 'enabled');
      helper.expectObjectField(localGood.lowAlerts, 'enabled');
      helper.rejectIfAbsent(localGood.lowAlerts, 'level');
      helper.expectNumericalField(localGood.lowAlerts, 'level');
      helper.rejectIfAbsent(localGood.lowAlerts, 'snooze');
      helper.expectNumericalField(localGood.lowAlerts, 'snooze');
      done();
    });
  });
  describe('lowAlerts', function () {
    helper.rejectIfAbsent(goodObject, 'lowAlerts');
    helper.expectObjectField(goodObject, 'lowAlerts');

    it('fields', function(done){
      var localGood = _.cloneDeep(goodObject);
      helper.rejectIfAbsent(localGood.lowAlerts, 'enabled');
      helper.expectObjectField(localGood.lowAlerts, 'enabled');
      helper.rejectIfAbsent(localGood.lowAlerts, 'level');
      helper.expectNumericalField(localGood.lowAlerts, 'level');
      helper.rejectIfAbsent(localGood.lowAlerts, 'snooze');
      helper.expectNumericalField(localGood.lowAlerts, 'snooze');
      done();
    });
  });
  describe('rateOfChangeAlerts', function () {
    helper.rejectIfAbsent(goodObject, 'rateOfChangeAlerts');
    helper.expectObjectField(goodObject, 'rateOfChangeAlerts');
  });
  /*describe('outOfRangeAlerts', function () {
    helper.rejectIfAbsent(goodObject, 'outOfRangeAlerts');
    helper.expectObjectField(goodObject, 'outOfRangeAlerts');
  });*/
  describe('rateOfChangeAlerts', function () {
    helper.rejectIfAbsent(goodObject, 'rateOfChangeAlerts');
    helper.expectObjectField(goodObject, 'rateOfChangeAlerts');
    it('fallRate', function(done){
      var localGood = _.cloneDeep(goodObject);
      helper.rejectIfAbsent(localGood, 'fallRate');
      helper.expectObjectField(localGood, 'fallRate');
      helper.rejectIfAbsent(localGood.fallRate, 'enabled');
      helper.expectObjectField(localGood.fallRate, 'enabled');
      helper.rejectIfAbsent(localGood.fallRate, 'rate');
      helper.expectNumericalField(localGood.fallRate, 'rate');
      done();
    });
    it('riseRate', function(done){
      var localGood = _.cloneDeep(goodObject);
      helper.rejectIfAbsent(localGood, 'riseRate');
      helper.expectObjectField(localGood, 'riseRate');
      helper.rejectIfAbsent(localGood.fallRate, 'enabled');
      helper.expectObjectField(localGood.fallRate, 'enabled');
      helper.rejectIfAbsent(localGood.fallRate, 'rate');
      helper.expectNumericalField(localGood.fallRate, 'rate');
      done();
    });
  });

  helper.testCommonFields(goodObject);
});