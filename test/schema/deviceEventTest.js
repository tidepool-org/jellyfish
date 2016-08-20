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

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var sinon = salinity.sinon;

var helper = require('./schemaTestHelper.js');
var schema = require('../../lib/schema/schema.js');

describe('schema/deviceEvent.js', function(){
  describe('calibration', function(){
    var goodObject = {
      type: 'deviceEvent',
      subType: 'calibration',
      value: 3.0,
      units: 'mg/dL',
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    describe('value', function(){
      helper.rejectIfAbsent(goodObject, 'value');
      helper.rejectIfAbsent(goodObject, 'units');
      helper.expectNumericalField(goodObject, 'value');

      it('converts "mmol/l" to "mmol/L"', function(done){
        helper.run(_.assign({}, goodObject, {value: 80, units: 'mmol/l'}), function(err, val){
          expect(val.units).equals('mmol/L');
          expect(val.value).equals(80);
          done(err);
        });
      });

      it('converts units from mg/dL to mmol/L', function(done){
        helper.run(_.assign({}, goodObject, {value: 80, units: 'mg/dL'}), function(err, val){
          expect(val.units).equals('mmol/L');
          expect(val.value).equals(4.440598392836427);
          done(err);
        });
      });

      it('converts units from mg/dl to mmol/L', function(done){
        helper.run(_.assign({}, goodObject, {value: 80, units: 'mg/dl'}), function(err, val){
          expect(val.units).equals('mmol/L');
          expect(val.value).equals(4.440598392836427);
          done(err);
        });
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('status', function(){
    var previousMatches = {
      type: 'deviceEvent',
      subType: 'status',
      status: 'suspended',
      reason: {suspended: 'automatic'},
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    var previousNoMatch = {
      type: 'deviceEvent',
      subType: 'status',
      status: 'suspended',
      reason: {suspended: 'manual'},
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    var goodObject = {
      type: 'deviceEvent',
      subType: 'status',
      status: 'resumed',
      reason: {resumed: 'manual'},
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
    });

    describe('status', function(){
      helper.rejectIfAbsent(goodObject, 'status');
      helper.expectStringField(goodObject, 'status');
      helper.expectFieldIn(goodObject, 'status', ['suspended', 'resumed']);

      it('allows suspended', function(done){
        helper.run(_.assign({}, goodObject, {status: 'suspended'}), done);
      });
    });

    describe('duration', function(){
      helper.okIfAbsent(goodObject, 'duration');
      helper.expectNumericalField(goodObject, 'duration');
    });

    describe('reason', function(){
      helper.rejectIfAbsent(goodObject, 'reason');
      helper.expectObjectField(goodObject, 'reason');

      it('suspended is a string field', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.reason.suspended = 1;
        helper.expectRejection(obj, 'reason', done);
      });

      it('suspended is not a `foo` value', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.reason.suspended = 'foo';
        helper.expectRejection(obj, 'reason', done);
      });

      it('resumed is a string field', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.reason.resumed = 1;
        helper.expectRejection(obj, 'reason', done);
      });

      it('resumed is not a `foo` value', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.reason.resumed = 'foo';
        helper.expectRejection(obj, 'reason', done);
      });

      it('cannot be empty', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.reason = {};
        helper.expectRejection(obj, 'reason', done);
      });
    });

    describe('previous', function(){
      helper.okIfAbsent(goodObject, 'previous');
      helper.expectObjectField(goodObject, 'previous');

      it('annotates resumed if no previous', function(done){
        var localGoodObject = _.assign({}, goodObject, { status: 'resumed' });
        helper.run(localGoodObject, done, function(objs) {
          helper.expectSubsetEqual(
            objs, _.assign({}, localGoodObject, {annotations: [{ code: "status/unknown-previous" }]})
          );
        });
      });

      it('annotates suspends if no previous', function(done){
        var localGoodObject = _.assign({}, goodObject, { status: 'suspended' });
        helper.run(localGoodObject, done, function(objs) {
          helper.expectSubsetEqual(
            objs, _.assign({}, localGoodObject, {annotations: [{ code: "status/incomplete-tuple" }]})
          );
        });
      });

      it('annotates resumed if previous doesn\'t exist', function(done){
        var prevId = schema.makeId(previousNoMatch);

        helper.resetMocks();
        sinon.stub(helper.streamDAO, 'getDatum');
        helper.streamDAO.getDatum
          .withArgs(prevId, goodObject._groupId, sinon.match.func)
          .callsArgWith(2, null, null);

        var localGoodObject = _.assign({}, goodObject, { status: 'resumed', previous: previousNoMatch });
        helper.run(localGoodObject, done, function(objs) {
          expect(_.pick(objs, 'annotations', Object.keys(localGoodObject))).deep.equals(
            _.assign({}, localGoodObject, {annotations: [{ code: "status/unknown-previous", id: prevId }]})
          );
        });
      });

      it('annotates suspended if previous doesn\'t exist', function(done){
        var prevId = schema.makeId(previousNoMatch);

        helper.resetMocks();
        sinon.stub(helper.streamDAO, 'getDatum');
        helper.streamDAO.getDatum
          .withArgs(prevId, goodObject._groupId, sinon.match.func)
          .callsArgWith(2, null, null);

        var localGoodObject = _.assign({}, goodObject, { previous: previousNoMatch });
        helper.run(localGoodObject, done, function(objs) {
          helper.expectSubsetEqual(
            objs, _.assign({}, localGoodObject, {annotations: [{ code: "status/unknown-previous", id: prevId }]})
          );
        });
      });

      it('updates duration when previous exists, throws away resumed event and removes annotation', function(done){
        var prevId = schema.makeId(previousMatches);

        helper.resetMocks();
        sinon.stub(helper.streamDAO, 'getDatum');
        helper.streamDAO.getDatum
          .withArgs(prevId, goodObject._groupId, sinon.match.func)
          .callsArgWith(2, null, schema.annotateEvent(previousMatches, 'status/incomplete-tuple'));

        var localGoodObject = _.assign({}, goodObject, { status: 'resumed' });
        helper.run(_.assign({}, localGoodObject, {previous: previousMatches}), done, function(objs) {
          helper.expectSubsetEqual(objs, _.assign({}, previousMatches, {duration: 60 * 60 * 1000}, {reason: _.assign({}, localGoodObject.reason, previousMatches.reason)}));
        });
      });

      it('updates duration when previous exists, maintains suspended event', function(done){
        var prevId = schema.makeId(previousMatches);

        helper.resetMocks();
        sinon.stub(helper.streamDAO, 'getDatum');
        helper.streamDAO.getDatum
          .withArgs(prevId, goodObject._groupId, sinon.match.func)
          .callsArgWith(2, null, _.clone(previousMatches));

        var localGoodObject = _.assign({}, goodObject, { status: 'suspended' });
        helper.run(_.assign({}, localGoodObject, {previous: previousMatches}), done, function(objs) {
          expect(objs).length(2);
          helper.expectSubsetEqual(objs[0], _.assign({}, previousMatches, {duration: 60 * 60 * 1000}, {reason: _.assign({}, localGoodObject.reason, previousMatches.reason)}));
          helper.expectSubsetEqual(objs[1], _.assign({}, localGoodObject, {annotations: [{ code: "status/incomplete-tuple" }]}));
        });
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('alarm', function() {
    var goodObject = {
      type: 'deviceEvent',
      subType: 'alarm',
      alarmType: 'low_insulin',
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    describe('alarmType', function() {
      helper.rejectIfAbsent(goodObject, 'alarmType');
      helper.expectStringField(goodObject, 'alarmType');
      helper.expectFieldIn(goodObject, 'alarmType', [
        'low_insulin',
        'no_insulin',
        'low_power',
        'no_power',
        'occlusion',
        'no_delivery',
        'auto_off',
        'over_limit',
        'other'
      ]);
    });

    describe('status', function() {
      helper.okIfAbsent(goodObject, 'status');
      helper.expectNotNumberField(_.assign({}, goodObject, {status: {
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: 'automatic',
        deviceTime: '2014-01-01T02:00:00',
        time: '2014-01-01T00:00:00.000Z',
        timezoneOffset: 120,
        conversionOffset: 0,
        deviceId: 'test',
        uploadId: 'test',
        _userId: 'u',
        _groupId: 'g'
      }}), 'status');
    });

    helper.testCommonFields(goodObject);
  });

  describe('reservoirChange', function() {
    var goodObject = {
      type: 'deviceEvent',
      subType: 'alarm',
      alarmType: 'low_insulin',
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    describe('status', function() {
      helper.okIfAbsent(goodObject, 'status');
      helper.expectNotNumberField(_.assign({}, goodObject, {status: {
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: 'automatic',
        deviceTime: '2014-01-01T02:00:00',
        time: '2014-01-01T00:00:00.000Z',
        timezoneOffset: 120,
        conversionOffset: 0,
        deviceId: 'test',
        uploadId: 'test',
        _userId: 'u',
        _groupId: 'g'
      }}), 'status');
    });

    helper.testCommonFields(goodObject);
  });

  describe('prime', function() {
    var goodObject = {
      type: 'deviceEvent',
      subType: 'prime',
      primeTarget: 'cannula',
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    describe('primeTarget', function() {
      helper.rejectIfAbsent(goodObject, 'primeTarget');
      helper.expectStringField(goodObject, 'primeTarget');
      helper.expectFieldIn(goodObject, 'primeTarget', ['cannula', 'tubing']);
    });

    describe('volume', function() {
      helper.okIfAbsent(goodObject, 'volume');
      var withVolume = _.assign({}, goodObject, {volume: 0.5});
      helper.expectNumericalField(withVolume, 'volume');
    });

    helper.testCommonFields(goodObject);
  });

  describe('timeChange', function() {
    var goodObject = {
      type: 'deviceEvent',
      subType: 'timeChange',
      change: {
        from: '2015-03-08T12:02:00',
        to: '2015-03-08T13:00:00',
        agent: 'manual',
        reasons: ['to_daylight_savings', 'correction'],
        timezone: 'US/Pacific'
      },
      deviceTime: '2015-03-08T12:02:00',
      time: '2015-03-08T21:00:00.000Z',
      timezoneOffset: -480,
      conversionOffset: 120000,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g'
    };

    describe('change', function() {
      helper.rejectIfAbsent(goodObject, 'change');
      helper.expectObjectField(goodObject, 'change');

      it('change.from is required', function(done) {
        var obj = _.cloneDeep(goodObject);
        delete obj.change.from;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.from is a string', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.from = 1;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.from is a properly-formatted deviceTime', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.from = '2015-03-08 12:02:00';
        helper.expectRejection(obj, 'change', done);
      });

      it('change.to is required', function(done) {
        var obj = _.cloneDeep(goodObject);
        delete obj.change.to;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.to is a string', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.to = 1;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.to is a properly-formatted deviceTime', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.to = '2015-03-08T13:00:00.000Z';
        helper.expectRejection(obj, 'change', done);
      });

      it('change.agent is a string', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.agent = 1;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.agent can only be `manual` or `automatic`', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.agent = 'foo';
        helper.expectRejection(obj, 'change', done);
      });

      it('change.agent is required', function(done) {
        var obj = _.cloneDeep(goodObject);
        delete obj.change.agent;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.reasons is an array', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.reasons = 1;
        helper.expectRejection(obj, 'change', done);
      });

      it('change.reasons does not accept any old string values', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.reasons = ['foo', 'bar'];
        helper.expectRejection(obj, 'change', done);
      });

      it('change.timezone is a string', function(done) {
        var obj = _.cloneDeep(goodObject);
        obj.change.timezone = 1;
        helper.expectRejection(obj, 'change', done);
      });
    });

    helper.testCommonFields(goodObject);
  });
});
