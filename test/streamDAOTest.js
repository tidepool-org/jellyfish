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

var async = require('async');

var _ = require('lodash');
var expect = require('salinity').expect;

var misc = require('../lib/misc.js');
var mongoClient = require('../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/data_test', closeDelay: 0 }
);
var streamDAO = require('../lib/streamDAO.js')(mongoClient);

describe('streamDAO', function(){
  before(function(done) {
    mongoClient.start(done);
  });

  beforeEach(function(done){
    mongoClient.withCollection('deviceData', done, function(coll, cb) {
      coll.deleteMany({}, cb);
    });
  });

  after(function(done){
    mongoClient.close(done);
  });

  it('shouldn\'t find a value that isn\'t there', function(done){
    streamDAO.getDatum('abcd', 'g', function(err, datum){
      expect(datum).to.not.exist;

      done(err);
    });
  });

  describe('insert', function(){
    it('should be able to find a value that is there', function(done){
      var now = Date.now();
      streamDAO.insertDatum({id: 'abcd', v: 1, _userId: 'u', _groupId: 'g'}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', 'g', function(err, datum){
          expect(datum).to.exist;
          expect(new Date(datum.createdTime).valueOf()).that.is.within(now, Date.now());
          expect(_.omit(datum, 'createdTime', '_id')).to.deep.equals(
            { id: 'abcd', v: 1, _userId: 'u', _groupId: 'g', _version: 0, _active: true }
          );

          done(err);
        });
      });
    });
  });

  describe('update', function(){
    var createdTime = '';

    beforeEach(function(done){
      streamDAO.insertDatum({id: 'abcd', v: 1, f: 'a', _userId: 'u', _groupId: 'g'}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', 'g', function(err, datum){
          createdTime = datum.createdTime;
          done(err);
        });
      });
    });

    it('cannot update a value that does not exist', function(done){
      streamDAO.updateDatum({id: 'abcde', f: 'a', v: 2828, _userId: 'u', _groupId: 'g'}, function(err){
        expect(err).to.exist;

        streamDAO.getDatum('abcde', 'g', function(err, datum){
          expect(datum).to.not.exist;
          return done(err);
        });
      });
    });

    it('should be able to update a value that is there', function(done){
      var now = Date.now();
      streamDAO.updateDatum({id: 'abcd', f: 'a', v: 2828, _userId: 'u', _groupId: 'g', createdTime: createdTime}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', 'g', function(err, datum){
          expect(datum).to.exist;
          expect(new Date(datum.modifiedTime).valueOf()).that.is.within(now, Date.now());
          expect(_.omit(datum, 'modifiedTime', '_archivedTime', '_id')).to.deep.equals(
            { id: 'abcd', f: 'a', v: 2828, _userId: 'u', _groupId: 'g', createdTime: createdTime, _version: 1, _active: true }
          );

          var overwrittenId = datum._id + '_0';
          mongoClient.withCollection('deviceData', done, function(coll, done){
            coll.find({_id: overwrittenId}).toArray(function(err, elements){
              expect(elements).to.have.length(1);
              expect(elements[0]._archivedTime).that.is.within(now, Date.now());
              expect(_.omit(elements[0], '_archivedTime')).to.deep.equals(
                { _id: overwrittenId, id: 'abcd', f: 'a', _userId: 'u', _groupId: 'g', v: 1, createdTime: createdTime, _version: 0, _active: false }
              );

              done(err);
            });
          });
        });
      });
    });

    it('should be able to update a value that is there, even in a race', function(done){
      var count = 0;

      function theCallback(err){
        if (err != null) {
          return done(err);
        }

        if (count === 0) {
          ++count;
          return;
        }

        mongoClient.withCollection('deviceData', done, function(coll, done){
          coll.find({f: 'a'}).toArray(function(err, elements){
            expect(elements).to.have.length(3);
            expect(elements.map(function(e){ return e._id; })).to.include.members(
              [expectedId, expectedId + '_0', expectedId + '_1']
            );
            expect(elements.filter(function(e){ return e._active; })).to.have.length(1);
            expect(elements.filter(function(e){ return e._active; })[0]).to.have.property('id').equals('abcd');

            done(err);
          });
        });
      }

      var expectedId = misc.generateId(['abcd', 'g']);
      streamDAO.updateDatum({id: 'abcd', f: 'a', v: 2828, _userId: 'u', _groupId: 'g'}, theCallback);
      streamDAO.updateDatum({id: 'abcd', f: 'a', v: 2829, _userId: 'u', _groupId: 'g'}, theCallback);
    });
  });

  describe('getDatumBefore', function(){
    var events = [
      { id: 'ab', time: '2014-01-01T00:00:00.000Z', type: 'none', deviceId: 'a', source: 's', _userId: 'u', _groupId: 'g', val: 0 },
      { id: 'abc', time: '2014-01-01T01:00:00.000Z', type: 'none', deviceId: 'a', source: 's', _userId: 'u', _groupId: 'g', val: 1 },
      { id: 'abcd', time: '2014-01-01T02:00:00.000Z', type: 'none', deviceId: 'a', source: 's', _userId: 'u', _groupId: 'g', val: 2 }
    ];

    beforeEach(function(done){
      async.map(events, streamDAO.insertDatum, done);
    });

    it('returns null if nothing before', function(done){
      streamDAO.getDatumBefore(
        { time: '2014-01-01T00:00:00.000Z', type: 'none', deviceId: 'a', source: 's', _userId: 'u', _groupId: 'g' },
        function(err, datum){
          expect(datum).to.equal.null;
          done(err);
        }
      );
    });

    describe('find previous', function(){
      var matchingEvent = { time: '2014-01-01T01:30:00.000Z', type: 'none', deviceId: 'a', source: 's', _userId: 'u', _groupId: 'g' };

      it('returns the previous event', function(done){
        streamDAO.getDatumBefore(
          matchingEvent,
          function(err, datum){
            expect(datum).to.exist;
            expect(_.pick(datum, Object.keys(events[1]))).to.deep.equal(events[1]);
            done(err);
          }
        );
      });

      it('previous event must share a deviceId', function(done){
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, {deviceId: 'b'}),
          function(err, datum){
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a source', function(done){
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, {source: 'r'}),
          function(err, datum){
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a _groupId', function(done){
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, {_groupId: 'h'}),
          function(err, datum){
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a type', function(done){
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, {type: 'some'}),
          function(err, datum){
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });
    });
  });
});
