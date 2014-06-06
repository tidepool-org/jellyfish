/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var sinon = salinity.sinon;

var helper = require('./schemaTestHelper.js');

function rejectIfAbsent(field) {
  it(util.format('rejects if field %s is not present', field), function(done){
    helper.expectRejection(_.omit(goodObject, field), field, done);
  });
}

function okIfAbsent(field) {
  it(util.format('allows the field %s to be absent', field), function(done){
    helper.run(_.omit(goodObject, field), done);
  });
}

describe('schema/basal.js', function(){
  describe('injected', function(){
    var goodObject = {
      type: 'basal',
      deliveryType: 'injected',
      value: 3.0,
      duration: 14400000,
      insulin: 'novolog',
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
        })
      }

      acceptsInsulinVals('novolog', 'levemir', 'lantus', 'humalog');

      it('rejects unknown insulin', function(done){
        helper.expectRejection(_.assign({}, goodObject, {insulin: 'unknown'}), 'insulin', done);
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('scheduled', function(){
    var previousMatches = {
      _id: '_prevMatches',
      id: 'prevMatches',
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 3600000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: {}
    };

    var previousCutShort = {
      _id: '_prevCutShort',
      id: 'prevCutShort',
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: {}
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
      helper.streamDAO.getDatum.withArgs(previousMatches._id, sinon.match.func).callsArgWith(1, null, previousMatches);
      helper.streamDAO.getDatum.withArgs(previousCutShort._id, sinon.match.func).callsArgWith(1, null, previousCutShort);
    });

    describe('rate', function(){
      helper.rejectIfAbsent(goodObject, 'rate');
      helper.expectNumericalField(goodObject, 'rate');
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

      it('updates the duration of previous events if they no longer align', function(done){
        var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});

        helper.run(localGoodObject, function(err, objs){
          expect(objs).length(2);

          expect(objs[0]).deep.equals(
            _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration})
          );
          expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(localGoodObject);

          return done(err);
        })
      })
    });

    describe('scheduleName', function(){
      helper.rejectIfAbsent(goodObject, 'scheduleName');
      helper.expectStringField(goodObject, 'scheduleName');
    });

    helper.testCommonFields(goodObject);
  });

  describe('temp', function(){
    var previousMatches = {
      _id: '_prevMatches',
      id: 'prevMatches',
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 3600000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: {}
    };

    var previousCutShort = {
      _id: '_prevCutShort',
      id: 'prevCutShort',
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: 'Pattern A',
      rate: 1.0,
      duration: 7200000,
      time: '2014-01-01T00:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g',
      previous: {}
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
      helper.streamDAO.getDatum.withArgs(previousMatches._id, sinon.match.func).callsArgWith(1, null, previousMatches);
      helper.streamDAO.getDatum.withArgs(previousCutShort._id, sinon.match.func).callsArgWith(1, null, previousCutShort);
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
          expect(obj).length(1);
          expect(obj[0].rate).equals(0.5);
          expect(_.pick(obj[0], Object.keys(localGoodObject))).deep.equals(localGoodObject);
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

      it('rejects duration == 0', function(done){
        helper.expectRejection(_.assign({}, goodObject, {duration: 0}), 'duration', done);
      });

      it('updates the duration of previous events if they no longer align', function(done){
        var localGoodObject = _.assign({}, goodObject, {previous: previousCutShort});

        helper.run(localGoodObject, function(err, objs){
          expect(objs).length(2);

          expect(objs[0]).deep.equals(
            _.assign({}, previousCutShort, {duration: 3600000, expectedDuration: previousCutShort.duration})
          );
          expect(_.pick(objs[1], Object.keys(localGoodObject))).deep.equals(localGoodObject);

          return done(err);
        });
      });
    });

    describe('suppressed', function(){
      helper.rejectIfAbsent(goodObject, 'suppressed');
      helper.expectObjectField(goodObject, 'suppressed');
    });

    helper.testCommonFields(goodObject);
  });
});
