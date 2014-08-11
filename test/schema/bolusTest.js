/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var _ = require('lodash');
var salinity = require('salinity');

var expect = salinity.expect;
var sinon = salinity.sinon;

var bolus = require('../../lib/schema/bolus.js');
var helper = require('./schemaTestHelper.js');
var schema = require('../../lib/schema/schema.js');

describe('schema/bolus.js', function(){
  describe('injected', function(){
    var goodObject = {
      type: 'bolus',
      subType: 'injected',
      value: 3.0,
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

      acceptsInsulinVals('novolog', 'humalog');

      it('rejects unknown insulin', function(done){
        helper.expectRejection(_.assign({}, goodObject, {insulin: 'unknown'}), 'insulin', done);
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('normal', function(){
    var goodObject = {
      _id: 'good',
      type: 'bolus',
      subType: 'normal',
      normal: 1.0,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };
    var objId = schema.generateId(goodObject, bolus.idFields);

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(objId, goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, goodObject);
    });

    describe('normal', function(){
      helper.rejectIfAbsent(goodObject, 'normal');
      helper.expectNumericalField(goodObject, 'normal');

      describe('on completion', function(){
        it('returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('updates normal if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject, normal: 0.5}), function(err, obj){
            expect(obj.normal).equals(0.5);
            expect(obj.expectedNormal).equals(goodObject.normal);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'normal', 'expectedNormal')).deep.equals(
              _.omit(goodObject, 'normal')
            );
            done(err);
          });
        });

        it('id-only, returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {previous: objId}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('id-only, updates normal if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: objId, normal: 0.5}), function(err, obj){
            expect(obj.normal).equals(0.5);
            expect(obj.expectedNormal).equals(goodObject.normal);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'normal', 'expectedNormal')).deep.equals(
              _.omit(goodObject, 'normal')
            );
            done(err);
          });
        });
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('square', function(){
    var goodObject = {
      _id: 'good',
      type: 'bolus',
      subType: 'square',
      extended: 1.0,
      duration: 3600000,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };
    var objId = schema.generateId(goodObject, bolus.idFields);

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(objId, goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, goodObject);
    });

    describe('extended', function(){
      helper.rejectIfAbsent(goodObject, 'extended');
      helper.expectNumericalField(goodObject, 'extended');

      describe('on completion', function(){
        it('returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('updates extended if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject, extended: 0.5}), function(err, obj){
            expect(obj.extended).equals(0.5);
            expect(obj.expectedExtended).equals(goodObject.extended);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'extended', 'expectedExtended')).deep.equals(
              _.omit(goodObject, 'extended')
            );
            done(err);
          });
        });

        it('id-only, returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {previous: objId}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('id-only, updates extended if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: objId, extended: 0.5}), function(err, obj){
            expect(obj.extended).equals(0.5);
            expect(obj.expectedExtended).equals(goodObject.extended);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'extended', 'expectedExtended')).deep.equals(
              _.omit(goodObject, 'extended')
            );
            done(err);
          });
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

      describe('on completion', function(){
        it('updates duration if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject, duration: 1800000}), function(err, obj){
            expect(obj.duration).equals(1800000);
            expect(obj.expectedDuration).equals(goodObject.duration);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration')).deep.equals(
              _.omit(goodObject, 'duration')
            );
            done(err);
          });
        });

        it('updates duration and extended if no match', function(done){
          helper.run(_.assign({}, goodObject, {previous: goodObject, duration: 1800000, extended: 0.6}), function(err, obj){
            expect(obj.duration).equals(1800000);
            expect(obj.expectedDuration).equals(goodObject.duration);
            expect(obj.extended).equals(0.6);
            expect(obj.expectedExtended).equals(goodObject.extended);
            expect(
              _.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration', 'extended', 'expectedExtended')
            ).deep.equals(
              _.omit(goodObject, 'duration', 'extended')
            );
            done(err);
          });
        });
      });
    });

    helper.testCommonFields(goodObject);
  });

  describe('square', function(){
    var goodObject = {
      _id: 'good',
      type: 'bolus',
      subType: 'dual/square',
      normal: 2.0,
      extended: 1.0,
      duration: 3600000,
      time: '2014-01-01T01:00:00.000Z',
      timezoneOffset: 120,
      deviceId: 'test',
      source: 'manual',
      _groupId: 'g'
    };
    var objId = schema.generateId(goodObject, bolus.idFields);

    beforeEach(function(){
      helper.resetMocks();
      sinon.stub(helper.streamDAO, 'getDatum');
      helper.streamDAO.getDatum
        .withArgs(objId, goodObject._groupId, sinon.match.func)
        .callsArgWith(2, null, goodObject);
    });

    describe('normal', function(){
      helper.rejectIfAbsent(goodObject, 'normal');
      helper.expectNumericalField(goodObject, 'normal');

      describe('on completion', function(){
        it('returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'normal', previous: goodObject}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('updates normal if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'normal', previous: goodObject, normal: 0.5}), function(err, obj){
            expect(obj.normal).equals(0.5);
            expect(obj.expectedNormal).equals(goodObject.normal);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'normal', 'expectedNormal')).deep.equals(
              _.omit(goodObject, 'normal')
            );
            done(err);
          });
        });

        it('id-only, returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'normal', previous: objId}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('id-only, updates normal if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'normal', previous: objId, normal: 0.5}), function(err, obj){
            expect(obj.normal).equals(0.5);
            expect(obj.expectedNormal).equals(goodObject.normal);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'normal', 'expectedNormal')).deep.equals(
              _.omit(goodObject, 'normal')
            );
            done(err);
          });
        });
      });
    });

    describe('extended', function(){
      helper.rejectIfAbsent(goodObject, 'extended');
      helper.expectNumericalField(goodObject, 'extended');

      describe('on completion', function(){
        it('returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: goodObject}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('updates extended if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: goodObject, extended: 0.5}), function(err, obj){
            expect(obj.extended).equals(0.5);
            expect(obj.expectedExtended).equals(goodObject.extended);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'extended', 'expectedExtended')).deep.equals(
              _.omit(goodObject, 'extended')
            );
            done(err);
          });
        });

        it('id-only, returns nothing if completion matches', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: objId}), function(err, objs){
            expect(objs).length(0);
            done(err);
          });
        });

        it('id-only, updates extended if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: objId, extended: 0.5}), function(err, obj){
            expect(obj.extended).equals(0.5);
            expect(obj.expectedExtended).equals(goodObject.extended);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'extended', 'expectedExtended')).deep.equals(
              _.omit(goodObject, 'extended')
            );
            done(err);
          });
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

      describe('on completion', function(){
        it('updates duration if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: goodObject, duration: 1800000}), function(err, obj){
            expect(obj.duration).equals(1800000);
            expect(obj.expectedDuration).equals(goodObject.duration);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration')).deep.equals(
              _.omit(goodObject, 'duration')
            );
            done(err);
          });
        });

        it('updates duration and extended if no match', function(done){
          helper.run(
            _.assign({}, goodObject, {subType: 'square', previous: goodObject, duration: 1800000, extended: 0.6}),
            function(err, obj){
              expect(obj.duration).equals(1800000);
              expect(obj.expectedDuration).equals(goodObject.duration);
              expect(obj.extended).equals(0.6);
              expect(obj.expectedExtended).equals(goodObject.extended);
              expect(
                _.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration', 'extended', 'expectedExtended')
              ).deep.equals(
                _.omit(goodObject, 'duration', 'extended')
              );
              done(err);
            }
          );
        });

        it('id-only, updates duration if no match', function(done){
          helper.run(_.assign({}, goodObject, {subType: 'square', previous: objId, duration: 1800000}), function(err, obj){
            expect(obj.duration).equals(1800000);
            expect(obj.expectedDuration).equals(goodObject.duration);
            expect(_.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration')).deep.equals(
              _.omit(goodObject, 'duration')
            );
            done(err);
          });
        });

        it('id-only, updates duration and extended if no match', function(done){
          helper.run(
            _.assign({}, goodObject, {subType: 'square', previous: objId, duration: 1800000, extended: 0.6}),
            function(err, obj){
              expect(obj.duration).equals(1800000);
              expect(obj.expectedDuration).equals(goodObject.duration);
              expect(obj.extended).equals(0.6);
              expect(obj.expectedExtended).equals(goodObject.extended);
              expect(
                _.omit(_.pick(obj, Object.keys(goodObject)), 'duration', 'expectedDuration', 'extended', 'expectedExtended')
              ).deep.equals(
                _.omit(goodObject, 'duration', 'extended')
              );
              done(err);
            }
          );
        });
      });
    });

    helper.testCommonFields(goodObject);
  });
});
