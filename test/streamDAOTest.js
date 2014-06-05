/*
 * == BSD2 LICENSE ==
 */

'use strict';

var async = require('async');

var _ = require('lodash');
var expect = require('salinity').expect;

var mongoClient = require('../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/test_streams', closeDelay: 0 }
);
var streamDAO = require('../lib/streamDAO.js')(mongoClient);

describe('streamDAO', function(){
  before(function(done) {
    mongoClient.start(done);
  });

  beforeEach(function(done){
    mongoClient.withCollection('deviceData', done, function(coll, cb) {
      coll.remove(cb);
    });
  });

  after(function(done){
    mongoClient.close(done);
  });

  it('shouldn\'t find a value that isn\'t there', function(done){
    streamDAO.getDatum('abcd', function(err, datum){
      expect(datum).to.not.exist;

      done(err);
    });
  });

  describe('insert', function(){
    it('should be able to find a value that is there', function(done){
      var now = Date.now();
      streamDAO.insertDatum({_id: 'abcd', v: 1, groupId: 'g'}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', function(err, datum){
          expect(datum).to.exist;
          expect(new Date(datum.createdTime).valueOf()).that.is.within(now, Date.now());
          expect(_.omit(datum, 'createdTime')).to.deep.equals(
            { _id: 'abcd', v: 1, groupId: 'g', _sequenceId: 0, _active: true }
          );

          done(err);
        });
      });
    });
  });

  describe('update', function(){
    var createdTime = '';

    beforeEach(function(done){
      streamDAO.insertDatum({_id: 'abcd', v: 1, f: 'a', groupId: 'g'}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', function(err, datum){
          createdTime = datum.createdTime;
          done(err);
        });
      });
    });

    it('cannot update a value that does not exist', function(done){
      var now = Date.now();
      streamDAO.updateDatum({_id: 'abcde', f: 'a', v: 2828, groupId: 'g'}, function(err){
        expect(err).to.exist;

        streamDAO.getDatum('abcde', function(err, datum){
          expect(datum).to.not.exist;
          return done(err);
        })
      });
    });

    it('should be able to update a value that is there', function(done){
      var now = Date.now();
      streamDAO.updateDatum({_id: 'abcd', f: 'a', v: 2828, groupId: 'g'}, function(err){
        if (err != null) {
          return done(err);
        }

        streamDAO.getDatum('abcd', function(err, datum){
          expect(datum).to.exist;
          expect(new Date(datum.modifiedTime).valueOf()).that.is.within(now, Date.now());
          expect(_.omit(datum, 'modifiedTime')).to.deep.equals(
            { _id: 'abcd', f: 'a', v: 2828, groupId: 'g', createdTime: createdTime, _sequenceId: 1, _active: true }
          );

          mongoClient.withCollection('deviceData', done, function(coll, done){
            coll.find({_id: 'abcd_0'}).toArray(function(err, elements){
              expect(elements).to.have.length(1);
              expect(elements[0]).to.deep.equals(
                { _id: 'abcd_0', f: 'a', groupId: 'g', v: 1, createdTime: createdTime, _sequenceId: 0, _active: false }
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

        if (count == 0) {
          ++count;
          return;
        }

        mongoClient.withCollection('deviceData', done, function(coll, done){
          coll.find({f: 'a'}).toArray(function(err, elements){
            expect(elements).to.have.length(3);
            expect(elements.map(function(e){ return e._id; })).to.include.members(['abcd', 'abcd_0', 'abcd_1']);
            expect(elements.filter(function(e){ return e._active; })).to.have.length(1);
            expect(elements.filter(function(e){ return e._active; })[0]).to.have.property('_id').equals('abcd');

            done(err);
          });
        });
      }

      streamDAO.updateDatum({_id: 'abcd', f: 'a', v: 2828, groupId: 'g'}, theCallback);
      streamDAO.updateDatum({_id: 'abcd', f: 'a', v: 2829, groupId: 'g'}, theCallback);
    });
  });
});