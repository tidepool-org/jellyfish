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

var fs = require('fs');

var async = require('async');

var _ = require('lodash');
var expect = require('salinity').expect;

var mongoClient = require('../../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/data_test', closeDelay: 0 }
);
var streamDAO = require('../../lib/streamDAO.js')(mongoClient);
var dataBroker = require('../../lib/dataBroker.js')(streamDAO);

var userId = "abcd";
var groupId = "1234";

const convertDateStrings = (key, value) => (key === "time") ? new Date(value) : value;

describe('ingestion API', function () {
  before(function(done){
    mongoClient.start(done);
  });

  beforeEach(function (done) {
    mongoClient.withCollection('deviceData', done, function (coll, cb) {
      coll.deleteMany({}, cb);
    });
  });

  beforeEach(function (done) {
    mongoClient.withCollection('summary', done, function (coll, cb) {
      coll.deleteMany({}, cb);
    });
  });

  var files = fs.readdirSync(__dirname);
  function testDir(dir) {
    var path = __dirname + '/' + dir;
    it(dir, function (done) {
      var input = JSON.parse(fs.readFileSync(path + '/input.json'));
      var output = JSON.parse(fs.readFileSync(path + '/output.json'), convertDateStrings);
      let updatedSummary = {cgm: false, bgm: false};

      // we convert summary-relevant types to last year so that summaries are generated for them
      if (dir === 'cbg' || dir === 'smbg') {
        for (let i = 0; i < input.length; i++) {
          let newDatumTime = new Date(input[i].time);
          let today = new Date();
          newDatumTime.setFullYear(today.getFullYear()-1);
          input[i].time = newDatumTime.toISOString();
          output[i].time = newDatumTime;
        }
      }

      async.mapSeries(
        input,
        function(e, cb){
          e._userId = userId;
          e._groupId = groupId;
          dataBroker.addDatum(e, updatedSummary, cb);
        },
        function(err){
          if (err != null) {
            return done(err);
          }

          console.log('checking summaries');
          if (dir === 'cbg') {
            console.log('checking cgm');
            streamDAO.getSummary(userId, 'cgm', function (err, summary){
              console.log(summary);
              expect(summary).to.exist();
              expect(summary).type.equals('cgm');
            });
            streamDAO.getSummary(userId, 'bgm', function (err, summary){
              console.log(summary);
              expect(err).to.not.exist();
              expect(summary).to.not.exist();
            });
          } else if (dir === 'smbg') {
            console.log('checking bgm');
            streamDAO.getSummary(userId, 'cgm', function (err, summary){
              console.log(summary);
              expect(err).to.not.exist();
              expect(summary).to.not.exist();
            });
            streamDAO.getSummary(userId, 'bgm', function (err, summary){
              console.log(summary);
              expect(summary).to.exist();
              expect(summary).type.equals('bgm');
            });
          }
          console.log('checking data');

          mongoClient.withCollection('deviceData', done, function(coll, cb){
            coll.find().sort({"time": 1, "id": 1, "_version": 1}).toArray(function(err, results){
              expect(results.map(function(e){ return _.omit(e, 'createdTime', 'modifiedTime', "_id", '_archivedTime'); }))
                .deep.equals(output.map(function(e){ e._userId = userId; e._groupId = groupId; return e; }));
              cb(err);
            });
          });
        }
      );
    });
    var badInput;
    try {
      badInput = JSON.parse(fs.readFileSync(path + '/bad.json'));
      it(dir + ': outdated uploader version errors', function(done) {
        let updatedSummary = {cgm: false, bgm: false};
        async.mapSeries(
          badInput,
          function(e, cb){
            e._userId = userId;
            e._groupId = groupId;
            dataBroker.addDatum(e, updatedSummary, cb);
          },
          function(err) {
            expect(err.message).to.equal('The minimum supported version is [0.99.0]. Version [tidepool-uploader 0.98.0] is no longer supported.');
            expect(err.statusCode).to.equal(400);
            expect(err.code).to.equal('outdatedVersion');
            expect(err.errorField).to.equal('version');
            done();
          }
        );
      });
    }
    catch (e) {
      if (e.code !== 'ENOENT') {
        throw(e);
      }
    }
  }
  for (var i = 0; i < files.length; ++i) {
    var path = __dirname + '/' + files[i];
    if (fs.lstatSync(path).isDirectory()) {
      (testDir)(files[i]);
    }
  }
});
