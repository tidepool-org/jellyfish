/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var sinon = salinity.sinon;

var deviceMeta = require('../../lib/schema/deviceMeta.js');
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
        .withArgs(schema.generateId(previousMatches, deviceMeta.idFields), goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, previousMatches);
    });

    describe('status', function(){
      helper.rejectIfAbsent(goodObject, 'status');
      helper.expectStringField(goodObject, 'status');

      it('allows suspended', function(done){
        helper.run(_.assign({}, goodObject, {status: 'suspended'}), done);
      });
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

      it('includes previous if it doesn\'t match', function(done){
        var prevId = schema.generateId(previousNoMatch, deviceMeta.idFields);

        helper.resetMocks();
        sinon.stub(helper.streamDAO, 'getDatum');
        helper.streamDAO.getDatum
          .withArgs(prevId, goodObject._groupId, sinon.match.func)
          .callsArgWith(2, null, null);

        var localGoodObject = _.assign({}, goodObject, {previous: previousNoMatch});

        helper.run(localGoodObject, function(err, objs){
          expect(objs).length(2);
          expect(_.pick(objs[0], Object.keys(previousNoMatch))).deep.equals(previousNoMatch);
          expect(_.pick(objs[1], Object.keys(goodObject))).deep.equals(goodObject);
          expect(objs[1].previous).equals(prevId);

          return done(err);
        });
      });
    });

    helper.testCommonFields(goodObject);
  });
});
