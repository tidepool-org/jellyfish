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
var schema = require('../../lib/schema/schema.js');

var goodObject = {
  type: 'note',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  displayTime: '2014-01-01T07:00:00.000Z',
  deviceId: 'test',
  source: 'manual',
  _groupId: 'g',
  shortText: '1234',
  text: 'Howdy ho, this is a note',
  creatorId: 'abcd'
};

var reference = {
  type: 'smbg',
  time: '2013-11-27T17:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  value: 1.12,
  _groupId: 'g'
};

beforeEach(function(){
  helper.resetMocks();
  sinon.stub(helper.streamDAO, 'getDatum');
  helper.streamDAO.getDatum
    .withArgs(schema.makeId(reference), goodObject._groupId, sinon.match.func)
    .callsArgWith(2, null, reference);
});

describe('schema/cbg.js', function(){

  describe('shortText', function(){
    helper.okIfAbsent(goodObject, 'shortText');
    helper.expectStringField(goodObject, 'shortText');
  });

  describe('text', function(){
    helper.rejectIfAbsent(goodObject, 'text');
    helper.expectStringField(goodObject, 'text');
  });

  describe('creatorId', function(){
    helper.rejectIfAbsent(goodObject, 'creatorId');
    helper.expectStringField(goodObject, 'creatorId');
  });

  describe('displayTime', function(){
    helper.okIfAbsent(goodObject, 'displayTime');
    helper.expectStringField(goodObject, 'displayTime');
  });

  describe('reference', function(){
    helper.expectNotNumberField(goodObject, 'reference');

    it('Updates the time based on the reference', function(done){
      var localGood = _.assign({}, goodObject, {reference: reference});

      helper.run(localGood, function(err, datum) {
        if (err != null) {
          return done(err);
        }

        expect(datum.reference).equals(schema.makeId(reference));
        expect(datum.time).equals(reference.time);
        expect(datum.displayTime).equals(goodObject.displayTime);
        done();
      });
    });

    it('Also updates the displayTime, if not defined', function(done){
      var localGood = _.assign(_.omit(goodObject, 'displayTime'), {reference: reference});

      helper.run(localGood, function(err, datum) {
        if (err != null) {
          return done(err);
        }

        expect(datum.reference).equals(schema.makeId(reference));
        expect(datum.time).equals(reference.time);
        expect(datum.displayTime).equals(goodObject.time);
        done();
      });
    });
  });

  helper.testCommonFields(goodObject);
});