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
var misc = require('../../lib/misc.js');

describe('schema/basal.js', function(){
  function resetMocks() {
    helper.resetMocks();
    sinon.stub(helper.streamDAO, 'ensureInternalId', misc.ensureInternalId);
    sinon.stub(helper.streamDAO, 'generateInternalId', misc.generateInternalId);
    sinon.stub(helper.streamDAO, 'generateExternalId', misc.generateExternalId);
  }

  // Mock the streamDAO.getDataInTimeRangeAndBefore because that normally makes
  // a db call for all data in a certain range.
  function mock_getDataInTimeRangeAndBefore(streamDAO, groupId, returnedObjs) {
    // Allow "re-mocking" to change any previous stubbed returned values w/o
    // throwing an error.
    if (typeof streamDAO.getDataInTimeRangeAndBefore.restore === 'function') {
      streamDAO.getDataInTimeRangeAndBefore.restore();
    }

    // Since the object would in reality be fetched from the db, ensure
    // the _id and id fields are set.
    const array = (returnedObjs||[]).map(obj => {
      const externalId = misc.generateExternalId(obj);
      const internalId = misc.generateInternalId(externalId, groupId);
      obj = Object.assign({}, obj, {_groupId: groupId, _id: internalId, id: externalId });
      return obj;
    });
    const stub = sinon.stub(streamDAO, 'getDataInTimeRangeAndBefore');
    stub
      .withArgs(sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.func)
      .callsArgWith(3, null, array);
  }

  beforeEach(function(){
      resetMocks();
      mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);
    });

  describe('injected', function(){
    var goodObject = {
      type: 'basal',
      deliveryType: 'injected',
      value: 3.0,
      duration: 14400000,
      insulin: 'levemir',
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
      helper.expectFieldIn(goodObject, 'insulin', ['levemir', 'lantus']);
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
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test'
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test'
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'scheduled',
      rate: 1.0,
      duration: 7200000,
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g',
      previous: previousMatches
    };

    beforeEach(function(){
      resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);

      mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);
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
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);

          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);
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

        it('does NOT update the duration of previous basal events if the new event extends the previous longer', function(done){
          resetMocks();
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);

          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:02:00.000Z'});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('maintains the duration of previous events if the new event happens after the older one', function(done){
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);

          mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);

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
            annotations: [{ code: 'basal/mismatched-series', nextId: 'a84k2igl7pul6cu9ap63bar175du1gfi' }]
          });

          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatumBefore');
          helper.streamDAO.getDatumBefore
            .withArgs(localGoodObject, sinon.match.func)
            .callsArgWith(1, null, previousCutShort);

          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);

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
            annotations: [{ code: 'basal/mismatched-series', nextId: 'a84k2igl7pul6cu9ap63bar175du1gfi' }],
            duration: 3600000,
            expectedDuration: previousCutShort.duration
          });

          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatumBefore');
          helper.streamDAO.getDatumBefore
            .withArgs(localGoodObject, sinon.match.func)
            .callsArgWith(1, null, previousCutShort);

          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });
      });

      describe('previous [final basal]', function(){
        var prevId = schema.makeId(previousMatches);

        beforeEach(function(){
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, _.assign({}, previousMatches, {
              annotations: [{code: 'final-basal/fabricated-from-schedule'}]
            }));
          const newPreviousMatch = _.assign({}, previousMatches, {
            annotations: [{code: 'final-basal/fabricated-from-schedule'}]
          });
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [newPreviousMatch]);
        });

        it('updates the duration of previous final basal events if the new event extends the previous longer than fabricated', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T01:02:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3720000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous final basal events if the new event cuts the previous short', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T00:58:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3480000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('does not update the duration of previous final basal events if the new event has the same duration', function(done){
          var localGoodObject = _.assign({}, goodObject);
          var expectedPrevious = _.assign({}, previousMatches);

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
      helper.okIfAbsent(goodObject, 'scheduleName');
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
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'suspend',
      duration: 1800000,
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g',
      previous: previousMatches,
      suppressed: previousCutShort
    };

    beforeEach(function(){
      resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
      mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);
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
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);
        });

        it('updates the duration of previous events if the new event cuts off the older one', function(done){
          var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});
          var expectedPrevious = _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration});
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);
          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('does NOT update the duration of previous basal events if the new event extends the previous longer', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:02:00.000Z'});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

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

      describe('previous [final basal]', function(){
        var prevId = schema.makeId(previousMatches);

        beforeEach(function(){
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, _.assign({}, previousMatches, {
              annotations: [{code: 'final-basal/fabricated-from-schedule'}]
            }));
          const newPreviousMatch = _.assign({}, previousMatches, {
            annotations: [{code: 'final-basal/fabricated-from-schedule'}]
          });
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [newPreviousMatch]);
        });

        it('updates the duration of previous final basal events if the new event extends the previous longer than fabricated', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T01:02:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3720000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous final basal events if the new event cuts the previous short', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T00:58:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3480000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('does not update the duration of previous final basal events if the new event has the same duration', function(done){
          var localGoodObject = _.assign({}, goodObject);
          var expectedPrevious = _.assign({}, previousMatches);

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
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
    };

    var previousCutShort = {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      deviceTime: '2014-01-01T02:00:00',
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
    };

    var goodObject = {
      type: 'basal',
      deliveryType: 'temp',
      rate: 0.6,
      percent: 0.5,
      duration: 1800000,
      deviceTime: '2014-01-01T03:00:00',
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      conversionOffset: 0,
      deviceId: 'test',
      uploadId: 'test',
      _userId: 'u',
      _groupId: 'g',
      previous: previousMatches,
      suppressed: previousCutShort
    };

    beforeEach(function(){
      resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(schema.makeId(previousMatches), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
      mock_getDataInTimeRangeAndBefore(helper.streamDAO, '', []);
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
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, previousCutShort);
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [previousCutShort]);
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

        it('does NOT update the duration of previous basal events if the new event extends the previous longer', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T02:02:00.000Z'});

          helper.run(localGoodObject, function(err, obj){
            expect(_.pick(obj, Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

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

      describe('previous [final basal]', function(){
        var prevId = schema.makeId(previousMatches);

        beforeEach(function(){
          resetMocks();
          sinon.stub(helper.streamDAO, 'getDatum');
          helper.streamDAO.getDatum
            .withArgs(prevId, goodObject._groupId, sinon.match.func)
            .callsArgWith(2, null, _.assign({}, previousMatches, {
              annotations: [{code: 'final-basal/fabricated-from-schedule'}]
            }));
          const newPreviousMatch = _.assign({}, previousMatches, {
            annotations: [{code: 'final-basal/fabricated-from-schedule'}]
          });
          mock_getDataInTimeRangeAndBefore(helper.streamDAO, goodObject._groupId, [newPreviousMatch]);
        });

        it('updates the duration of previous final basal events if the new event extends the previous longer than fabricated', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T01:02:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3720000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('updates the duration of previous final basal events if the new event cuts the previous short', function(done){
          var localGoodObject = _.assign({}, goodObject, {time: '2014-01-01T00:58:00.000Z'});
          var expectedPrevious = _.assign({}, previousMatches, {duration: 3480000});

          helper.run(localGoodObject, function(err, objs){
            expect(objs).length(2);

            expect(_.pick(objs[0], Object.keys(expectedPrevious))).deep.equals(expectedPrevious);
            expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(_.omit(localGoodObject, 'previous'));

            return done(err);
          });
        });

        it('does not update the duration of previous final basal events if the new event has the same duration', function(done){
          var localGoodObject = _.assign({}, goodObject);
          var expectedPrevious = _.assign({}, previousMatches);

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
