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

const util = require('util');

var fs = require('fs');

var async = require('async');

var _ = require('lodash');
var expect = require('salinity').expect;

var mongoClient = require('../../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/data_test', closeDelay: 0 }
);
var streamDAO = require('../../lib/streamDAO.js')(mongoClient);
var dataBroker = require('../../lib/dataBroker.js')(streamDAO);

const generateSamples = function (sample, n) {
  const samples = [];
  const now = new Date();

  let time = new Date();
  time.setFullYear(now.getFullYear() - 1);

  for (let i=0; i<n;i++) {
    samples.push({
      ...sample,
      time: time.toISOString(),
    });
    time = new Date(time.getTime() + 5*60000);
  }

  return samples;
};

describe('Summaries', function () {
  before(function(done){
    mongoClient.start(done);
  });

  beforeEach(function (done) {
    async.parallel([
      (cb) => {
        mongoClient.withCollection('summary', cb, function (coll, cb) {
          coll.deleteMany({}, cb);
        });
      },
    ], done);
  });

  after(function(done){
    mongoClient.close(done);
  });

  describe('setSummaryOutdated', function(){
    const cbg = JSON.parse(fs.readFileSync(__dirname + '/cbg/input.json'))[0];
    const smbg = JSON.parse(fs.readFileSync(__dirname + '/smbg/input.json'))[0];

    const batch = generateSamples(cbg, 500).concat(generateSamples(smbg, 500));

    const setSummariesOutdated = util.promisify(dataBroker.setSummariesOutdated);
    const getSummary = util.promisify(streamDAO.getSummary);

    it('should not return an error or create a summary if the user id is undefined', async function() {
      await setSummariesOutdated(undefined, batch, batch.length);

      const coll = mongoClient.collection('summary');
      const count = await coll.countDocuments({});
      expect(count).to.equal(0);
    });

    it('should not return an error or create a summary if the user id is empty', async function() {
      await setSummariesOutdated('', batch, batch.length);

      const coll = mongoClient.collection('summary');
      const count = await coll.countDocuments({});
      expect(count).to.equal(0);
    });

   it('should create a new summary for each data type in the batch', async function() {
     await setSummariesOutdated('1', batch, batch.length);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     expect(cgm).to.exist;
     expect(bgm).to.exist;
   });

   it('should create a new summary only if the type is in the batch', async function() {
     await setSummariesOutdated('1', batch.slice(0, 500), 500);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     expect(cgm).to.exist;
     expect(bgm).to.not.exist;
   });

   it('should set outdated reason to LEGACY_DATA_ADDED with full batch', async function() {
     await setSummariesOutdated('1', batch, batch.length);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     expect(cgm).to.exist;
     expect(cgm.dates?.outdatedReason).to.deep.equal(['LEGACY_DATA_ADDED']);
     expect(bgm).to.exist;
     expect(bgm.dates?.outdatedReason).to.deep.equal(['LEGACY_DATA_ADDED']);
   });

   it('should set outdated since ~90 seconds in the future with a full batch', async function() {
     await setSummariesOutdated('1', batch, batch.length);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     const now = new Date().getTime();

     expect(cgm).to.exist;
     expect(cgm.dates?.outdatedSince).to.exist;

     const cgmbuffer = (cgm.dates.outdatedSince.getTime() - now) / 1000;
     expect(cgmbuffer).to.be.above(85);
     expect(cgmbuffer).to.be.below(95);

     expect(bgm).to.exist;
     expect(bgm.dates?.outdatedSince).to.exist;

     const bgmbuffer = (bgm.dates.outdatedSince.getTime() - now) / 1000;
     expect(bgmbuffer).to.be.above(85);
     expect(bgmbuffer).to.be.below(95);
   });

   it('should set outdated reason to LEGACY_UPLOAD_COMPLETED with an incomplete batch', async function() {
     await setSummariesOutdated('1', batch.slice(0, batch.length -1), batch.length - 1);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     expect(cgm).to.exist;
     expect(cgm.dates?.outdatedReason).to.deep.equal(['LEGACY_UPLOAD_COMPLETED']);
     expect(bgm).to.exist;
     expect(bgm.dates?.outdatedReason).to.deep.equal(['LEGACY_UPLOAD_COMPLETED']);
   });

   it('should set outdated since to the current time with an incomplete batch', async function() {
     await setSummariesOutdated('1', batch.slice(0, batch.length -1), batch.length - 1);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     const now = new Date().getTime();

     expect(cgm).to.exist;
     expect(cgm.dates?.outdatedSince).to.exist;

     const cgmbuffer = Math.abs((cgm.dates.outdatedSince.getTime() - now) / 1000);
     expect(cgmbuffer).to.be.below(5);

     expect(bgm).to.exist;
     expect(bgm.dates?.outdatedSince).to.exist;

     const bgmbuffer = Math.abs((bgm.dates.outdatedSince.getTime() - now) / 1000);
     expect(bgmbuffer).to.be.below(5);
   });

   it('should set outdated reason to LEGACY_DATA_ADDED when the batch was not fully ingested', async function() {
     await setSummariesOutdated('1', batch, batch.length - 1);
     const cgm = await getSummary('1', 'cgm');
     const bgm = await getSummary('1', 'bgm');

     expect(cgm).to.exist;
     expect(cgm.dates?.outdatedReason).to.deep.equal(['LEGACY_DATA_ADDED']);
     expect(bgm).to.exist;
     expect(bgm.dates?.outdatedReason).to.deep.equal(['LEGACY_DATA_ADDED']);
   });
  });
});
