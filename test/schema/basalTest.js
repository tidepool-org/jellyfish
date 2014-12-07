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

describe('schema/basal.js', function(){
  describe('injected', function(){
    var goodObject = {
      type: 'basal',
      deliveryType: 'injected',
      value: 3.0,
      duration: 14400000,
      insulin: 'levemir',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };

    describe('value', function(){
      helper.rejectIfAbsent(goodObject, 'value');
      helper.expectNumericalField(goodObject, 'value');
    });

    describe('duration', function(){
      helper.rejectIfAbsent(goodObject, 'duration');
      helper.expectNumericalField(goodObject, 'duration');

      it('rejects duration < 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: -1}), 'duration', done);
      });

      it('rejects duration == 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: 0}), 'duration', done);
      });
    });

    describe('insulin', function(){
      helper.rejectIfAbsent(goodObject, 'insulin');
      helper.expectStringField(goodObject, 'insulin');

      function acceptsInsulinVals() {
        Array.prototype.slice.call(arguments, 0).forEach(function(val){
          it(util.format('accepts insulin: %s', val), function(done){
            helper.run(_.assign({}, goodObject, {insulin: val}), done);
          });
        });
      }

      acceptsInsulinVals('levemir', 'lantus');

      it('rejects unknown insulin', function(done){
        helper.expectRejection(_.assign({}, goodObject, {insulin: 'unknown'}), 'insulin', done);
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('scheduled', function(){
    var previousMatches = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 3600000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: previousMatches
    };

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
    });

    describe('rate', function(){
      helper.rejectIfAbsent(goodObject, 'rate');
      helper.expectNumericalField(goodObject, 'rate');
    });

    describe('duration', function(){
      helper.okIfAbsent(goodObject, 'duration');
      helper.expectNumericalField(goodObject, 'duration');

      it('rejects duration < 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: -1}), 'duration', done);
      });

      it('accepts duration == 0', function(done){
        helper.run(_.assign({}, goodObject, {duration: 0}), done);
      });

      describe('previous', function(){
        var prevId = schema.makeId(previousCutShort);

        beforeEach(function(){
          helper.resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);
        });

        it('updates the duration of previous events if the new event cuts off the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('maintains the duration of previous events if the new event happens after the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:00:00.000Z', previous: previousMatches});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous events even when passed only an id for previous', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: prevId});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('annotates the previous event when no previous provided and new event happens after old event', function(done){
          var localGoodObject = _.omit(goodObject, "previous");
          var expectedPrevious = _.assign({}, previousMatches, {
            annotations: [{ code: 'basal/mismatched-series', nextId: '2d3ij3nslb9rjsp6e6bantvr61tavpkk' }]
          });

          sinon.stub(helper.streamDAO, 'getDatumBefore');
          helper.streamDAO.getDatumBefore
            .withArgs(localGoodObject, sinon.match.func)
            .callsArgWith(1, null, previousCutShort);


          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates and annotates the previous event when no previous provided and new event cuts off old event', function(done){
          var localGoodObject = _.omit(goodObject, "previous");
          var expectedPrevious = _.assign({}, previousCutShort, {
            annotations: [{ code: 'basal/mismatched-series', nextId: '2d3ij3nslb9rjsp6e6bantvr61tavpkk' }],
            duration: 3600000,
            expectedDuration: previousCutShort.duration
          });

          sinon.stub(helper.streamDAO, 'getDatumBefore');
          helper.streamDAO.getDatumBefore
            .withArgs(localGoodObject, sinon.match.func)
            .callsArgWith(1, null, previousCutShort);


          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });
      });
    });

    describe('scheduleName', function(){
      helper.rejectIfAbsent(goodObject, 'scheduleName');
      helper.expectStringField(goodObject, 'scheduleName');
    });

    helper.testCommonFields(goodObject);
  });

  describe('suspend', function(){
    var previousMatches = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 3600000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'suspend',
      duration: 1800000,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: previousMatches,
      suppressed: previousCutShort
    };

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
    });

    describe('duration', function(){
      helper.okIfAbsent(goodObject, 'duration');
      helper.expectNumericalField(goodObject, 'duration');

      it('rejects duration < 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: -1}), 'duration', done);
      });

      it('accepts duration == 0', function(done){
        helper.run(_.assign({}, goodObject, {duration: 0}), done);
      });

      describe('previous', function(){
        var prevId = schema.makeId(previousCutShort);

        beforeEach(function(){
          helper.resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);
        });

        it('updates the duration of previous events if the new event cuts off the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('maintains the duration of previous events if the new event happens after the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:00:00.000Z', previous: previousMatches});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous events even when passed only an id for previous', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: prevId});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });
      });
    });

    describe('suppressed', function(){
      helper.okIfAbsent(goodObject, 'suppressed');
      helper.expectObjectField(goodObject, 'suppressed');
    });

    helper.testCommonFields(goodObject);
  });

  describe('temp', function(){
    var previousMatches = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 3600000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual'
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'temp',
      rate: 0.6,
      percent: 0.5,
      duration: 1800000,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: previousMatches,
      suppressed: previousCutShort
    };

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
    });

    describe('rate', function(){
      helper.okIfAbsent(goodObject, 'rate');
      helper.expectNumericalField(goodObject, 'rate');
    });

    describe('percent', function(){
      helper.okIfAbsent(goodObject, 'percent');
      helper.expectNumericalField(goodObject, 'percent');

      it('generates rate based on percent if rate absent', function(done){
        var localGoodObject = _.omit(goodObject, 'rate');
        helper.run(localGoodObject, function(err, obj) {
          var expectedObject = _.omit(localGoodObject, 'previous');

          expect(obj.rate).equals(0.5);
          expect(_.pick(obj, Object.keys(expectedObject))).deep.equals(expectedObject);
          done(err);
        });
      });
    });

    describe('duration', function(){
      helper.rejectIfAbsent(goodObject, 'duration');
      helper.expectNumericalField(goodObject, 'duration');

      it('rejects duration < 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: -1}), 'duration', done);
      });

      it('accepts duration == 0', function(done){
        helper.run(_.assign({}, goodObject, {duration: 0}), done);
      });

      describe('previous', function(){
        var prevId = schema.makeId(previousCutShort);

        beforeEach(function(){
          helper.resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);
        });

        it('updates the duration of previous events if the new event cuts off the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('maintains the duration of previous events if the new event happens after the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:00:00.000Z', previous: previousMatches});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous events even when passed only an id for previous', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: prevId});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });
      });
    });

    describe('suppressed', function(){
      helper.okIfAbsent(goodObject, 'suppressed');
      helper.expectObjectField(goodObject, 'suppressed');
    });

    helper.testCommonFields(goodObject);
  });
});
