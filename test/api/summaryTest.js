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

 /* global describe, beforeEach, it */

'use strict';

const util = require('util');

var fs = require('fs');

var expect = require('salinity').expect;

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

describe('Upload postprocess work', function () {
  const cbg = JSON.parse(fs.readFileSync(__dirname + '/cbg/input.json'))[0];
  const smbg = JSON.parse(fs.readFileSync(__dirname + '/smbg/input.json'))[0];

  const batch = generateSamples(cbg, 500).concat(generateSamples(smbg, 500));

  let created;
  const workClient = {
    createUploadPostprocessWork: function (userId, reason, availableTime, cb) {
      created.push({ userId, reason, availableTime });
      cb();
    }
  };
  const dataBroker = require('../../lib/dataBroker.js')({}, workClient);
  const createWork = util.promisify(dataBroker.createUploadPostprocessWork);

  beforeEach(function () {
    created = [];
  });

  describe('createUploadPostprocessWork', function () {
    it('should not return an error or create work if the user id is undefined', async function() {
      await createWork(undefined, batch, batch.length);
      expect(created).to.be.empty;
    });

    it('should not return an error or create work if the user id is empty', async function() {
      await createWork('', batch, batch.length);
      expect(created).to.be.empty;
    });

    it('should create one work item for the user however many summary types the batch updates', async function() {
      await createWork('1', batch, batch.length);
      expect(created).to.have.lengthOf(1);
      expect(created[0].userId).to.equal('1');
    });

    it('should create work when only one summary type is in the batch', async function() {
      await createWork('1', batch.slice(0, 500), 500);
      expect(created).to.have.lengthOf(1);
    });

    it('should not create work when the batch updates no summary type', async function() {
      const bolusOnly = generateSamples({ ...cbg, type: 'bolus' }, 10);
      await createWork('1', bolusOnly, bolusOnly.length);
      expect(created).to.be.empty;
    });

    it('should report LEGACY_DATA_ADDED deferred ~90 seconds with a full batch', async function() {
      await createWork('1', batch, batch.length);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('LEGACY_DATA_ADDED');

      const now = new Date().getTime();
      expect(created[0].availableTime).to.exist;

      const buffer = (created[0].availableTime.getTime() - now) / 1000;
      expect(buffer).to.be.above(85);
      expect(buffer).to.be.below(95);
    });

    it('should report UPLOAD_COMPLETED available immediately with an incomplete batch', async function() {
      await createWork('1', batch.slice(0, batch.length -1), batch.length - 1);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
      expect(created[0].availableTime).to.equal(null);
    });

    it('should report LEGACY_DATA_ADDED when the batch was not fully ingested', async function() {
      await createWork('1', batch, batch.length - 1);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('LEGACY_DATA_ADDED');
    });
  });
});
