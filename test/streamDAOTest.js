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
var mongoClient = require('../lib/mongo/mongoClient.js')({
  connectionString: 'mongodb://localhost/data_test',
  closeDelay: 0,
});
var streamDAO = require('../lib/streamDAO.js')(mongoClient);

describe('streamDAO', function () {
  before(function (done) {
    mongoClient.start(done);
  });

  beforeEach(function (done) {
    async.parallel(
      [
        (cb) => {
          mongoClient.withCollection('deviceData', cb, function (coll, cb) {
            coll.deleteMany({}, cb);
          });
        },
        (cb) => {
          mongoClient.withCollection('deviceDataSets', cb, function (coll, cb) {
            coll.deleteMany({}, cb);
          });
        },
      ],
      done
    );
  });

  beforeEach(function (done) {
    mongoClient.withCollection('summary', done, function (coll, cb) {
      coll.deleteMany({}, cb);
    });
  });

  after(function (done) {
    mongoClient.close(done);
  });

  it("shouldn't find a value that isn't there", function (done) {
    streamDAO.getDatum('abcd', 'g', function (err, datum) {
      expect(datum).to.not.exist;

      done(err);
    });
  });

  describe('insert', function () {
    it('should be able to find a value that is there', function (done) {
      var now = Date.now();
      streamDAO.insertDatum(
        { id: 'abcd', v: 1, _userId: 'u', _groupId: 'g' },
        function (err) {
          if (err != null) {
            return done(err);
          }

          streamDAO.getDatum('abcd', 'g', function (err, datum) {
            expect(datum).to.exist;
            expect(new Date(datum.createdTime).valueOf()).that.is.within(
              now,
              new Date()
            );
            expect(new Date(datum.modifiedTime).valueOf()).that.is.within(
              now,
              new Date()
            );
            expect(new Date(datum.modifiedTime).valueOf()).to.equal(
              new Date(datum.createdTime).valueOf()
            );
            expect(
              _.omit(
                datum,
                'createdTime',
                'modifiedTime',
                '_id',
                'deduplicator'
              )
            ).to.deep.equals({
              id: 'abcd',
              v: 1,
              _userId: 'u',
              _groupId: 'g',
              _version: 0,
              _active: true,
            });

            done(err);
          });
        }
      );
    });
  });

  describe('update', function () {
    var createdTime = '';

    beforeEach(function (done) {
      streamDAO.insertDatum(
        { id: 'abcd', v: 1, f: 'a', _userId: 'u', _groupId: 'g' },
        function (err) {
          if (err != null) {
            return done(err);
          }

          streamDAO.getDatum('abcd', 'g', function (err, datum) {
            createdTime = datum.createdTime;
            done(err);
          });
        }
      );
    });

    it('cannot update a value that does not exist', function (done) {
      streamDAO.updateDatum(
        { id: 'abcde', f: 'a', v: 2828, _userId: 'u', _groupId: 'g' },
        function (err) {
          expect(err).to.exist;

          streamDAO.getDatum('abcde', 'g', function (err, datum) {
            expect(datum).to.not.exist;
            return done(err);
          });
        }
      );
    });

    it('should be able to update a value that is there', function (done) {
      var now = Date.now();
      streamDAO.updateDatum(
        {
          id: 'abcd',
          f: 'a',
          v: 2828,
          _userId: 'u',
          _groupId: 'g',
          createdTime: createdTime,
        },
        function (err) {
          if (err != null) {
            return done(err);
          }

          streamDAO.getDatum('abcd', 'g', function (err, datum) {
            expect(datum).to.exist;
            expect(new Date(datum.modifiedTime).valueOf()).that.is.within(
              now,
              new Date()
            );
            expect(
              _.omit(
                datum,
                'modifiedTime',
                '_archivedTime',
                '_id',
                'deduplicator'
              )
            ).to.deep.equals({
              id: 'abcd',
              f: 'a',
              v: 2828,
              _userId: 'u',
              _groupId: 'g',
              createdTime: createdTime,
              _version: 1,
              _active: true,
            });

            var overwrittenId = datum._id + '_0';
            mongoClient.withCollection(
              'deviceData',
              done,
              function (coll, done) {
                coll
                  .find({ _id: overwrittenId })
                  .toArray(function (err, elements) {
                    expect(elements).to.have.length(1);
                    expect(elements[0]._archivedTime).that.is.within(
                      now,
                      Date.now()
                    );
                    expect(
                      _.omit(elements[0], 'modifiedTime', '_archivedTime')
                    ).to.deep.equals({
                      _id: overwrittenId,
                      id: 'abcd',
                      f: 'a',
                      _userId: 'u',
                      _groupId: 'g',
                      v: 1,
                      createdTime: createdTime,
                      _version: 0,
                      _active: false,
                    });

                    done(err);
                  });
              }
            );
          });
        }
      );
    });

    it('should be able to update a value that is there, even in a race', function (done) {
      var count = 0;

      function theCallback(err) {
        if (err != null) {
          return done(err);
        }

        if (count < 2) {
          ++count;
          return;
        }

        mongoClient.withCollection('deviceData', done, function (coll, done) {
          coll.find({ f: 'a' }).toArray(function (err, elements) {
            expect(elements).to.have.length(4);
            // use to.have instead of to.include because we're expecting an
            // exact number of elements.
            expect(
              elements.map(function (e) {
                return e._id;
              })
            ).to.have.members([
              expectedId,
              expectedId + '_0',
              expectedId + '_1',
              expectedId + '_2',
            ]);
            expect(
              elements.filter(function (e) {
                return e._active;
              })
            ).to.have.length(1);
            // Since all updates are executing concurrently we don't know
            // which update will "win" out so check that the property 'v' is
            // in one of the updated values.
            expect(
              elements.filter(function (e) {
                return e._active;
              })[0]
            )
              .to.have.property('v')
              .within(2828, 2830);
            expect(
              elements.filter(function (e) {
                return e._active;
              })[0]
            )
              .to.have.property('id')
              .equals('abcd');
            expect(
              elements.filter(function (e) {
                return e._active;
              })[0]
            )
              .to.have.property('_version')
              .equals(3);

            done(err);
          });
        });
      }

      var expectedId = misc.generateId(['abcd', 'g']);
      streamDAO.updateDatum(
        { id: 'abcd', f: 'a', v: 2828, _userId: 'u', _groupId: 'g' },
        theCallback
      );
      streamDAO.updateDatum(
        { id: 'abcd', f: 'a', v: 2829, _userId: 'u', _groupId: 'g' },
        theCallback
      );
      streamDAO.updateDatum(
        { id: 'abcd', f: 'a', v: 2830, _userId: 'u', _groupId: 'g' },
        theCallback
      );
    });
  });

  describe('getDatumBefore', function () {
    var events = [
      {
        id: 'ab',
        time: '2014-01-01T00:00:00.000Z',
        type: 'none',
        deviceId: 'a',
        source: 's',
        _userId: 'u',
        _groupId: 'g',
        val: 0,
      },
      {
        id: 'abc',
        time: '2014-01-01T01:00:00.000Z',
        type: 'none',
        deviceId: 'a',
        source: 's',
        _userId: 'u',
        _groupId: 'g',
        val: 1,
      },
      {
        id: 'abcd',
        time: '2014-01-01T02:00:00.000Z',
        type: 'none',
        deviceId: 'a',
        source: 's',
        _userId: 'u',
        _groupId: 'g',
        val: 2,
      },
    ];

    beforeEach(function (done) {
      async.map(events, streamDAO.insertDatum, done);
    });

    it('returns null if nothing before', function (done) {
      streamDAO.getDatumBefore(
        {
          time: new Date('2014-01-01T00:00:00.000Z'),
          type: 'none',
          deviceId: 'a',
          source: 's',
          _userId: 'u',
          _groupId: 'g',
        },
        function (err, datum) {
          expect(datum).to.equal.null;
          done(err);
        }
      );
    });

    describe('find previous', function () {
      var matchingEvent = {
        time: new Date('2014-01-01T01:30:00.000Z'),
        type: 'none',
        deviceId: 'a',
        source: 's',
        _userId: 'u',
        _groupId: 'g',
      };

      it('returns the previous event', function (done) {
        streamDAO.getDatumBefore(matchingEvent, function (err, datum) {
          expect(datum).to.exist;
          expect(_.pick(datum, Object.keys(events[1]))).to.deep.equal(
            events[1]
          );
          done(err);
        });
      });

      it('previous event must share a deviceId', function (done) {
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, { deviceId: 'b' }),
          function (err, datum) {
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a source', function (done) {
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, { source: 'r' }),
          function (err, datum) {
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a _groupId', function (done) {
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, { _groupId: 'h' }),
          function (err, datum) {
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });

      it('previous event must share a type', function (done) {
        streamDAO.getDatumBefore(
          _.assign({}, matchingEvent, { type: 'some' }),
          function (err, datum) {
            expect(datum).to.equal.null;
            done(err);
          }
        );
      });
    });
  });

  describe('CGM setSummaryOutdated', function () {
    it('setting summary outdated creates a summary', function (done) {
      streamDAO.setSummaryOutdated(
        '56789',
        'cgm',
        function (err, outdatedSinceTime) {
          expect(err).to.not.exist;
          expect(outdatedSinceTime).to.exist;

          streamDAO.getSummary('56789', 'cgm', function (err, summary) {
            expect(err).to.not.exist;
            expect(summary).to.exist;

            expect(summary.dates.outdatedSince.getTime()).to.equal(
              outdatedSinceTime.getTime()
            );
            return done(err);
          });
        }
      );
    });

    it('setting existing outdated summary outdated leaves it unchanged', function (done) {
      streamDAO.setSummaryOutdated(
        '12345',
        'cgm',
        function (err, outdatedSinceTime) {
          expect(err).to.not.exist;
          expect(outdatedSinceTime).to.exist;

          let outdatedSinceOne = outdatedSinceTime;

          streamDAO.setSummaryOutdated(
            '12345',
            'cgm',
            function (err, outdatedSinceTime) {
              expect(err).to.not.exist;
              expect(outdatedSinceTime).to.exist;

              expect(outdatedSinceOne.getTime()).to.equal(
                outdatedSinceTime.getTime()
              );

              streamDAO.getSummary('12345', 'cgm', function (err, summary) {
                expect(err).to.not.exist;
                expect(summary).to.exist;

                return done(err);
              });
            }
          );
        }
      );
    });

    it('setting existing summary outdated only adds the outdated flag', function (done) {
      let test_summary = {
        userId: '54321',
        type: 'cgm',
        extra: 'unchanged_value',
        dates: { outdatedSince: null, hasOutdatedSince: false },
      };
      streamDAO.insertSummary(test_summary, function (err) {
        expect(err).to.not.exist;

        streamDAO.getSummary('54321', 'cgm', function (err, summary) {
          expect(err).to.not.exist;
          expect(summary).to.exist;
          expect(summary.dates.outdatedSince).to.equal(null);
          expect(summary.dates.hasOutdatedSince).to.equal(false);

          expect(summary.extra).to.equal(test_summary.extra);

          streamDAO.setSummaryOutdated(
            '54321',
            'cgm',
            function (err, outdatedSinceTime) {
              expect(err).to.not.exist;
              expect(outdatedSinceTime).to.exist;

              streamDAO.getSummary('54321', 'cgm', function (err, summary) {
                expect(err).to.not.exist;
                expect(summary).to.exist;
                expect(summary.dates.outdatedSince.getTime()).to.equal(
                  outdatedSinceTime.getTime()
                );
                expect(summary.dates.hasOutdatedSince).to.equal(true);

                expect(summary.extra).to.equal(test_summary.extra);
                return done(err);
              });
            }
          );
        });
      });
    });
  });

  describe('BGM setSummaryOutdated', function () {
    it('setting summary outdated creates a summary', function (done) {
      streamDAO.setSummaryOutdated(
        '56789',
        'bgm',
        function (err, outdatedSinceTime) {
          expect(err).to.not.exist;
          expect(outdatedSinceTime).to.exist;

          streamDAO.getSummary('56789', 'bgm', function (err, summary) {
            expect(err).to.not.exist;
            expect(summary).to.exist;

            expect(summary.dates.outdatedSince.getTime()).to.equal(
              outdatedSinceTime.getTime()
            );
            return done(err);
          });
        }
      );
    });

    it('setting existing outdated summary outdated leaves it unchanged', function (done) {
      streamDAO.setSummaryOutdated(
        '12345',
        'bgm',
        function (err, outdatedSinceTime) {
          expect(err).to.not.exist;
          expect(outdatedSinceTime).to.exist;

          var outdatedSinceOne = outdatedSinceTime;

          streamDAO.setSummaryOutdated(
            '12345',
            'bgm',
            function (err, outdatedSinceTime) {
              expect(err).to.not.exist;
              expect(outdatedSinceTime).to.exist;

              expect(outdatedSinceOne.getTime()).to.equal(
                outdatedSinceTime.getTime()
              );
              return done(err);
            }
          );
        }
      );
    });

    it('setting existing summary outdated only adds the outdated flag', function (done) {
      let test_summary = {
        userId: '54321',
        type: 'bgm',
        extra: 'unchanged_value',
        dates: { outdatedSince: null, hasOutdatedSince: false },
      };
      streamDAO.insertSummary(test_summary, function (err) {
        expect(err).to.not.exist;

        streamDAO.getSummary('54321', 'bgm', function (err, summary) {
          expect(err).to.not.exist;
          expect(summary).to.exist;
          expect(summary.dates.outdatedSince).to.equal(null);
          expect(summary.dates.hasOutdatedSince).to.equal(false);

          expect(summary.extra).to.equal(test_summary.extra);

          streamDAO.setSummaryOutdated(
            '54321',
            'bgm',
            function (err, outdatedSinceTime) {
              expect(err).to.not.exist;
              expect(outdatedSinceTime).to.exist;

              streamDAO.getSummary('54321', 'bgm', function (err, summary) {
                expect(err).to.not.exist;
                expect(summary).to.exist;
                expect(summary.dates.outdatedSince.getTime()).to.equal(
                  outdatedSinceTime.getTime()
                );
                expect(summary.dates.hasOutdatedSince).to.equal(true);

                expect(summary.extra).to.equal(test_summary.extra);
                return done(err);
              });
            }
          );
        });
      });
    });
  });
});
