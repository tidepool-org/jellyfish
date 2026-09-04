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

const userId = 'abcd';
const sessionToken = 'session-token';
const serverToken = 'server-token';

const cbg = JSON.parse(fs.readFileSync(__dirname + '/cbg/input.json'))[0];
const upload = JSON.parse(fs.readFileSync(__dirname + '/upload/input.json'))[0];

// generateSamples returns n copies of the sample five minutes apart, so that their ids differ
function generateSamples(sample, n) {
  const samples = [];
  const start = new Date(sample.time);
  for (let i = 0; i < n; i++) {
    samples.push(Object.assign({}, sample, { time: new Date(start.getTime() + i * 5 * 60 * 1000).toISOString() }));
  }
  return samples;
}

// The upload API, with the platform data service stood in for by a local server that records the
// upload postprocess work it is asked to create.
describe('upload API', function () {
  let dataService;
  let workRequests;
  let workResponses;
  let respondToWork;

  let service;
  let port;

  const userApiClient = {
    checkToken: function (token, cb) { cb(null, token === sessionToken ? { userid: userId } : null); },
    withServerToken: function (cb) { cb(null, serverToken); }
  };
  const seagullClient = {
    getPrivatePair: function (userid, name, token, cb) { cb(null, { id: 'private-' + userid }); }
  };
  const gatekeeperClient = {
    userInGroup: function (userid, groupId, cb) { cb(null, {}); }
  };

  function listen(server, cb) {
    server.listen(0, '127.0.0.1', function () { cb(server.address().port); });
  }

  before(function (done) {
    dataService = http.createServer(function (req, res) {
      let body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('end', function () {
        workRequests.push({ method: req.method, url: req.url, headers: req.headers, body: JSON.parse(body) });
        workResponses.push(res);
        respondToWork(res);
      });
    });
    listen(dataService, function (dataServicePort) {
      // the service takes the port to listen on, so find a free one for it
      const probe = http.createServer();
      listen(probe, function (freePort) {
        probe.close(function () {
          port = freePort;
          service = require('../../lib/jellyfishService.js')(
            { httpPort: port, data: { service: '127.0.0.1:' + dataServicePort, timeout: 500 } },
            mongoClient,
            seagullClient,
            userApiClient,
            gatekeeperClient
          );
          mongoClient.start(function (err) {
            if (err != null) {
              return done(err);
            }
            service.start(done);
          });
        });
      });
    });
  });

  after(function (done) {
    service.close();
    dataService.closeAllConnections();
    dataService.close(function () {
      mongoClient.close(done);
    });
  });

  beforeEach(function (done) {
    workRequests = [];
    workResponses = [];
    respondToWork = function (res) {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'work-1' }));
    };
    async.each(['deviceData', 'deviceDataSets'], function (collectionName, cb) {
      mongoClient.withCollection(collectionName, cb, function (coll, cb) {
        coll.deleteMany({}, cb);
      });
    }, done);
  });

  afterEach(function () {
    // release the responses a test left hanging
    workResponses.forEach(function (res) { res.destroy(); });
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

  // The work is created after the upload is answered, so give it a moment to reach the data service
  function settled(cb) {
    setTimeout(cb, 200);
  }

  it('should write the data and create upload postprocess work for the user', function (done) {
    post(generateSamples(cbg, 3), function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);
        const request = workRequests[0];
        expect(request.method).to.equal('POST');
        expect(request.url).to.equal('/v1/work');
        expect(request.headers['x-tidepool-session-token']).to.equal(serverToken);
        expect(request.body).to.deep.equal({
          type: 'org.tidepool.data.upload.postprocess',
          groupId: 'org.tidepool.data.upload.postprocess:' + userId,
          serialId: 'org.tidepool.data.upload.postprocess:' + userId,
          processingTimeout: 300,
          metadata: { userId: userId, reasons: ['UPLOAD_COMPLETED'] }
        });
        done();
      });
    });
  });

  it('should defer the work of a full batch', function (done) {
    post(generateSamples(cbg, 1000), function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);
        const create = workRequests[0].body;
        expect(create.metadata.reasons).to.deep.equal(['LEGACY_DATA_ADDED']);
        const deferral = (new Date(create.processingAvailableTime).getTime() - Date.now()) / 1000;
        expect(deferral).to.be.above(80);
        expect(deferral).to.be.below(95);
        done();
      });
    });
  });

  it('should answer the upload without waiting for the data service', function (done) {
    respondToWork = function () {};

    const start = Date.now();
    post(generateSamples(cbg, 3), function (err, status) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(Date.now() - start).to.be.below(400);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);
        done();
      });
    });
  });

  it('should not create work for an empty upload', function (done) {
    post([], function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);

      settled(function () {
        expect(workRequests).to.be.empty;
        done();
      });
    });
  });

  it('should not create work for an upload record alone', function (done) {
    post([upload], function (err, status, duplicates) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);
      expect(duplicates).to.deep.equal([]);

      settled(function () {
        expect(workRequests).to.be.empty;
        done();
      });
    });
  });

  it('should create work when the upload is rejected', function (done) {
    post([{ type: 'unknown' }], function (err, status, body) {
      expect(err).to.not.exist;
      expect(status).to.equal(400);
      expect(body.statusCode).to.equal(400);
      expect(body.dataIndex).to.equal(0);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);
        expect(workRequests[0].body.metadata.reasons).to.deep.equal(['UPLOAD_COMPLETED']);
        done();
      });
    });
  });

  it('should not create work when the whole upload is a duplicate', function (done) {
    const samples = generateSamples(cbg, 3);
    post(samples, function (err, status) {
      expect(err).to.not.exist;
      expect(status).to.equal(200);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);

        post(samples, function (err, status, duplicates) {
          expect(err).to.not.exist;
          expect(status).to.equal(200);
          expect(duplicates).to.deep.equal([0, 1, 2]);

          settled(function () {
            expect(workRequests).to.have.lengthOf(1);
            done();
          });
        });
      });
    });
  });

  it('should create work for the data written before a rejected datum', function (done) {
    const samples = generateSamples(cbg, 2);
    post([samples[0], { type: 'unknown' }, samples[1]], function (err, status, body) {
      expect(err).to.not.exist;
      expect(status).to.equal(400);
      expect(body.dataIndex).to.equal(1);

      settled(function () {
        expect(workRequests).to.have.lengthOf(1);
        expect(workRequests[0].body.metadata.reasons).to.deep.equal(['UPLOAD_COMPLETED']);
        done();
      });
    });
  });
});
