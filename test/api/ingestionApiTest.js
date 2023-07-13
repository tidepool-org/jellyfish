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
var schemas = require('../../lib/schema')(streamDAO);

var userId = "abcd";
var groupId = "1234";

const convertDateStrings = (key, value) => (key === "time") ? new Date(value) : value;

describe('ingestion API', function () {
  before(function(done){
    mongoClient.start(done);
  });

  beforeEach(function (done) {
    async.parallel([
      (cb) => {
        mongoClient.withCollection('deviceData', cb, function (coll, cb) {
          coll.deleteMany({}, cb);
        });
      },
      (cb) => {
        mongoClient.withCollection('deviceDataSets', cb, function (coll, cb) {
          coll.deleteMany({}, cb);
        });
      }
    ], done);
  });

  beforeEach(function (done) {
    mongoClient.withCollection('summary', done, function (coll, cb) {
      coll.deleteMany({}, cb);
    });
  });

  var files = fs.readdirSync(__dirname);
  function testDir(dir) {
    var path = __dirname + '/' + dir;
    var input = JSON.parse(fs.readFileSync(path + '/input.json'));
    var output = JSON.parse(fs.readFileSync(path + '/output.json'), convertDateStrings);
    let updatedSummary = {cgm: false, bgm: false};

    // datum types that explicitly support inserting in parallel.
    const parallelTypes = schemas.getGroupableDatumTypes();

    if (parallelTypes.indexOf(dir) > -1) {
      it(`${dir} parallel inserts`, function(done) {
        const array = input.map(obj => Object.assign({}, obj, {_userId: userId, _groupId: groupId}));

        dataBroker.addData(array, updatedSummary, (err, res) => {
          if (err != null) {
            return done(err);
          }

          mongoClient.withCollection('deviceData', done, function(coll, cb){
            // Note we only check active data and do not check for _version.
            // This is because in the old serial insertion way, if there are
            // two datums, A and B, if A is inserted first, then B is
            // inserted, and B modifies A, there will be 3 datums in total:
            //
            // A (_version == 0, _active == false)
            // A (_version == 1, _active == true)
            // B (_version == 0, _active == true).
            //
            // The parallel functions will "omit" the insertion of A, then
            // update of A, and instead will just have a single insert of A
            // with the latest data. Because of this, there is only one
            // version for each unique id in an array of data.

            coll.find({_active: true}).sort({"time": 1, "id": 1, "_version": 1}).toArray(function(err, results){
              const filterdOutput = output.filter(obj => obj._active).map(obj => _.omit(obj, '_version'));
              expect(results.map(function(e){ return _.omit(e, 'createdTime', 'modifiedTime', "_id", '_archivedTime', '_version'); }))
                .deep.equals(filterdOutput.map(function(e){ e._userId = userId; e._groupId = groupId; return e; }));
                cb(err);
            });
          });
        });
      });
    }

    it(dir, function (done) {
      async.mapSeries(
        input,
        function(e, cb){
          e._userId = userId;
          e._groupId = groupId;
          dataBroker.addData(e, updatedSummary, cb);
        },
        function(err){
          if (err != null) {
            return done(err);
          }

          const collectionName = input[0].type == 'upload' ? 'deviceDataSets' : 'deviceData';
          mongoClient.withCollection(collectionName, done, function(coll, cb){
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
            dataBroker.addData(e, updatedSummary, cb);
          },
          function(err) {
            expect(err.message).to.equal('The minimum supported version is [2.53.0]. Version [tidepool-uploader 0.98.0] is no longer supported.');
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
