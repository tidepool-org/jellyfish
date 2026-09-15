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
var axios = require('axios');

var expect = require('salinity').expect;

const generateSamples = require('./samples.js').generateSamples;

describe('Upload postprocess work', function () {
  const cbg = JSON.parse(fs.readFileSync(__dirname + '/cbg/input.json'))[0];
  const smbg = JSON.parse(fs.readFileSync(__dirname + '/smbg/input.json'))[0];
  const upload = JSON.parse(fs.readFileSync(__dirname + '/upload/input.json'))[0];

  const batch = generateSamples(cbg, 500).concat(generateSamples(smbg, 500));
  const rejected = { statusCode: 400, message: 'rejected' };

  let created;
  let workError;
  const workClient = {
    createUploadPostprocessWork: function (userId, reason, availableTime, cb) {
      created.push({ userId, reason, availableTime });
      cb(workError);
    }
  };
  const dataBroker = require('../../lib/dataBroker.js')({}, workClient);
  const createWork = util.promisify(dataBroker.createUploadPostprocessWork);

  beforeEach(function () {
    created = [];
    workError = null;
  });

  describe('createUploadPostprocessWork', function () {
    it('should not return an error or create work if the user id is undefined', async function() {
      await createWork(undefined, batch, batch, null);
      expect(created).to.be.empty;
    });

    it('should not return an error or create work if the user id is empty', async function() {
      await createWork('', batch, batch, null);
      expect(created).to.be.empty;
    });

    it('should not create work if nothing of the batch was stored', async function() {
      await createWork('1', batch, [], null);
      expect(created).to.be.empty;
    });

    it('should not create work for an empty request', async function() {
      await createWork('1', [], [], null);
      expect(created).to.be.empty;
    });

    it('should not create work if only upload records were stored', async function() {
      await createWork('1', [upload], [upload], null);
      expect(created).to.be.empty;
    });

    it('should not create work when the upload was rejected before anything was stored', async function() {
      await createWork('1', [upload, cbg], [], rejected);
      expect(created).to.be.empty;
    });

    it('should create work for the data stored before the upload failed', async function() {
      await createWork('1', [cbg, cbg], [cbg], rejected);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
      expect(created[0].availableTime).to.equal(null);
    });

    it('should report a failed full batch as the completed upload, available immediately', async function() {
      await createWork('1', batch, batch.slice(0, 10), rejected);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
      expect(created[0].availableTime).to.equal(null);
    });

    it('should create one work item for the user', async function() {
      await createWork('1', batch, batch, null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].userId).to.equal('1');
    });

    it('should create work when the batch updates no summary type', async function() {
      const bolusOnly = generateSamples({ ...cbg, type: 'bolus' }, 10);
      await createWork('1', bolusOnly, bolusOnly, null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
    });

    it('should create work for the data stored along with an upload record', async function() {
      await createWork('1', [upload, cbg], [upload, cbg], null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
    });

    it('should report LEGACY_DATA_ADDED deferred ~90 seconds with a full batch', async function() {
      await createWork('1', batch, batch, null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('LEGACY_DATA_ADDED');

      const now = new Date().getTime();
      expect(created[0].availableTime).to.exist;

      const buffer = (created[0].availableTime.getTime() - now) / 1000;
      expect(buffer).to.be.above(85);
      expect(buffer).to.be.below(95);
    });

    it('should report UPLOAD_COMPLETED available immediately with an incomplete batch', async function() {
      const incomplete = batch.slice(0, batch.length - 1);
      await createWork('1', incomplete, incomplete, null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('UPLOAD_COMPLETED');
      expect(created[0].availableTime).to.equal(null);
    });

    it('should report the size of the batch when only part of it was stored', async function() {
      await createWork('1', batch, batch.slice(0, 10), null);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('LEGACY_DATA_ADDED');
    });

    it('should not return an error when creating the work fails', async function() {
      workError = new Error('data service unavailable');
      await createWork('1', batch, batch, null);
      expect(created).to.have.lengthOf(1);
    });

    it('should log work request errors without the server token or request configuration', async function() {
      const token = 'synthetic-server-token';
      workError = new axios.AxiosError('connection refused', 'ECONNREFUSED', {
        headers: { 'x-tidepool-session-token': token }
      });
      const lines = [];
      const write = process.stdout.write;
      process.stdout.write = function(line) { lines.push(line); return true; };
      try {
        await createWork('1', batch, batch, null);
      } finally {
        process.stdout.write = write;
      }

      expect(lines).to.have.lengthOf(1);
      expect(lines[0]).to.not.contain(token);
      const record = JSON.parse(lines[0]);
      expect(record.err).to.not.have.property('config');
      expect(record.err).to.not.have.property('request');
      expect(record.err.message).to.equal('connection refused');
      expect(record.err.code).to.equal('ECONNREFUSED');
      expect(record.err.stack).to.be.a('string');
      expect(record.userId).to.equal('1');
    });
  });
});
