/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
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

 /* global describe, before, beforeEach, afterEach, it, after */

'use strict';

var fs = require('fs');
var http = require('http');

var async = require('async');
var expect = require('salinity').expect;

var mongoClient = require('../../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/data_test', closeDelay: 0 }
);

const generateSamples = require('./samples.js').generateSamples;

const userId = 'abcd';
const sessionToken = 'session-token';

const cbg = JSON.parse(fs.readFileSync(__dirname + '/cbg/input.json'))[0];
const upload = JSON.parse(fs.readFileSync(__dirname + '/upload/input.json'))[0];

// The upload API, with the work client stood in for by a double that records the upload postprocess
// work it is asked to create.
describe('upload API', function () {
  let created;
  let unanswered;
  let answerWork;

  const workClient = {
    createUploadPostprocessWork: function (userId, reason, availableTime, cb) {
      created.push({ userId, reason, availableTime });
      if (answerWork) {
        cb(null, { id: 'work-1' });
      } else {
        unanswered.push(cb);
      }
    }
  };
  const userApiClient = {
    checkToken: function (token, cb) { cb(null, token === sessionToken ? { userid: userId } : null); },
    withServerToken: function (cb) { cb(null, 'server-token'); }
  };
  const seagullClient = {
    getPrivatePair: function (userid, name, token, cb) { cb(null, { id: 'private-' + userid }); }
  };
  const gatekeeperClient = {
    userInGroup: function (userid, groupId, cb) { cb(null, {}); }
  };

  let service;
  let port;

  before(function (done) {
    service = require('../../lib/jellyfishService.js')(
      { httpPort: 0 },
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient,
      workClient
    );
    mongoClient.start(function (err) {
      if (err != null) {
        return done(err);
      }
      service.start(function (err, boundPort) {
        port = boundPort;
        done(err);
      });
    });
  });

  after(function (done) {
    service.close();
    mongoClient.close(done);
  });

  beforeEach(function (done) {
    created = [];
    unanswered = [];
    answerWork = true;
    async.each(['deviceData', 'deviceDataSets'], function (collectionName, cb) {
      mongoClient.withCollection(collectionName, cb, function (coll, cb) {
        coll.deleteMany({}, cb);
      });
    }, done);
  });

  afterEach(function () {
    // answer the creations a test left unanswered
    unanswered.forEach(function (cb) { cb(null, { id: 'work-1' }); });
  });

  function post(body, cb) {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: port,
      method: 'POST',
      path: '/data',
      agent: false,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
        'x-tidepool-session-token': sessionToken
      }
    }, function (res) {
      let responseBody = '';
      res.on('data', function (chunk) { responseBody += chunk; });
      res.on('end', function () { cb(null, res.statusCode, responseBody.length > 0 ? JSON.parse(responseBody) : null); });
    });
    req.on('error', cb);
    req.end(data);
  }

  // The work is created right after the response is sent, before the client can have read it, so
  // the work created is final by the time a test has the response.
  const immediateWork = { userId: userId, reason: 'UPLOAD_COMPLETED', availableTime: null };

  it('should write the data and create upload postprocess work for the user', function (done) {
    post(generateSamples(cbg, 3), function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);
      expect(created).to.deep.equal([immediateWork]);
      done();
    });
  });

  it('should defer the work of a full batch', function (done) {
    // the datums of a batch are written one at a time
    this.timeout(60000);
    post(generateSamples(cbg, 1000), function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);
      expect(created).to.have.lengthOf(1);
      expect(created[0].reason).to.equal('LEGACY_DATA_ADDED');
      const deferral = (created[0].availableTime.getTime() - Date.now()) / 1000;
      expect(deferral).to.be.above(80);
      expect(deferral).to.be.below(95);
      done();
    });
  });

  it('should answer the upload without waiting for the work to be created', function (done) {
    answerWork = false;
    post(generateSamples(cbg, 3), function (err, status) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(created).to.have.lengthOf(1);
      expect(unanswered).to.have.lengthOf(1);
      done();
    });
  });

  it('should not create work for an empty upload', function (done) {
    post([], function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);
      expect(created).to.be.empty;
      done();
    });
  });

  it('should not create work for an upload record alone', function (done) {
    post([upload], function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);
      expect(created).to.be.empty;
      done();
    });
  });

  it('should not create work when the upload is rejected before any data is stored', function (done) {
    post([{ type: 'unknown' }], function (err, status, body) {
      expect(err).to.not.exist;
      expect(status).to.equal(400);
      expect(body.statusCode).to.equal(400);
      expect(body.dataIndex).to.equal(0);
      expect(created).to.be.empty;
      done();
    });
  });

  it('should create work when the whole upload is a duplicate', function (done) {
    const samples = generateSamples(cbg, 3);
    post(samples, function (err, status) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);

      post(samples, function (err, status, duplicates) {
        expect(err).to.not.exist;
        expect(status).to.equal(200);
        expect(duplicates).to.deep.equal([0, 1, 2]);
        expect(created).to.deep.equal([immediateWork, immediateWork]);
        done();
      });
    });
  });

  it('should create work for the data stored before a rejected datum', function (done) {
    const samples = generateSamples(cbg, 2);
    post([samples[0], { type: 'unknown' }, samples[1]], function (err, status, body) {
      expect(err).to.not.exist;
      expect(status).to.equal(400);
      expect(body.dataIndex).to.equal(1);
      expect(created).to.deep.equal([immediateWork]);
      done();
    });
  });

  it('should create work and answer an error when the response cannot be sent', function (done) {
    // Stand in for an error that cannot be serialized, which express throws on
    const response = require('express').response;
    const send = response.send;
    response.send = function () {
      response.send = send;
      throw new TypeError('Converting circular structure to JSON');
    };

    post(generateSamples(cbg, 3), function (err, status, body) {
      response.send = send;
      expect(err).to.not.exist;
      expect(status).to.equal(500);
      expect(body).to.deep.equal({ statusCode: 500, message: 'Problem uploading data' });
      expect(created).to.deep.equal([immediateWork]);
      done();
    });
  });
});
