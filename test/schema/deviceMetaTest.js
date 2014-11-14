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

describe('schema/deviceMeta.js', function(){
  describe('calibration', function(){
    var goodObject = {
      type: 'deviceMeta',
      subType: 'calibration',
      value: 3.0,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };

    describe('value', function(){
      helper.rejectIfAbsent(goodObject, 'value');
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
          expect(val.units).equals('mg/dL');
          expect(val.value).equals(4.440598392836427);
          done(err);
        });
      });

      it('converts units from mg/dl to mmol/L', function(done){
        helper.run(_.assign({}, goodObject, {value: 80, units: 'mg/dl'}), function(err, val){
          expect(val.units).equals('mg/dL');
          expect(val.value).equals(4.440598392836427);
          done(err);
        });
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('status', function(){
    var previousMatches = {
      type: 'deviceMeta',
      subType: 'status',
      status: 'suspended',
      reason: 'low_glucose',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };

    var previousNoMatch = {
      type: 'deviceMeta',
      subType: 'status',
      status: 'suspended',
      reason: 'manual',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };

    var goodObject = {
      type: 'deviceMeta',
      subType: 'status',
      status: 'resumed',
      reason: 'manual',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
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
      helper.expectStringField(goodObject, 'reason');

      function allowsReason(obj, reason) {
        it(util.format('allows %s', reason), function(done){
          helper.run(_.assign({}, obj, {reason: reason}), done);
        });
      }

      describe('when resumed', function(){
        var localGoodObject = _.assign({}, goodObject, {status: 'resumed'});
        allowsReason(localGoodObject, 'manual');
        allowsReason(localGoodObject, 'automatic');

        it('rejects other', function(done){
          helper.expectRejection(_.assign({}, localGoodObject, {reason: 'other'}), 'reason', done);
        });
      });

      describe('when suspended', function(){
        var localGoodObject = _.assign({}, goodObject, {status: 'suspended'});
        allowsReason(localGoodObject, 'manual');
        allowsReason(localGoodObject, 'low_glucose');
        allowsReason(localGoodObject, 'alarm');

        it('rejects other', function(done){
          helper.expectRejection(_.assign({}, localGoodObject, {reason: 'other'}), 'reason', done);
        });
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
          helper.expectSubsetEqual(objs, _.assign({}, previousMatches, {duration: 60 * 60 * 1000}));
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
          helper.expectSubsetEqual(objs[0], _.assign({}, previousMatches, {duration: 60 * 60 * 1000}));
          helper.expectSubsetEqual(objs[1], _.assign({}, localGoodObject, {annotations: [{ code: "status/incomplete-tuple" }]}));
        });
      });
    });

    helper.testCommonFields(goodObject);
  });
});
