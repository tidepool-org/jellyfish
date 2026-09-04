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

var http = require('http');

var expect = require('salinity').expect;

var createWorkClient = require('../lib/workClient.js');

describe('workClient', function () {
  // A stand-in for the platform data service, recording the requests it receives.
  let server;
  let port;
  let requests;
  let responses;
  let respond;

  before(function (done) {
    server = http.createServer(function (req, res) {
      let body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('end', function () {
        requests.push({ method: req.method, url: req.url, headers: req.headers, body: body });
        responses.push(res);
        respond(res);
      });
    });
    server.listen(0, '127.0.0.1', function () {
      port = server.address().port;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  beforeEach(function () {
    requests = [];
    responses = [];
    respond = function (res) {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'work-1' }));
    };
  });

  afterEach(function () {
    // release the responses a test left hanging
    responses.forEach(function (res) { res.destroy(); });
  });

  const serverToken = 'server-token';
  const userApiClient = {
    withServerToken: function (cb) { cb(null, serverToken); }
  };
  const availableTime = new Date('2026-09-04T10:00:00.000Z');

  function createClient(service, config) {
    return createWorkClient(Object.assign({ service: service }, config), userApiClient);
  }

  describe('construction', function () {
    it('should require the config', function () {
      expect(function () { createWorkClient(undefined, userApiClient); }).to.throw();
    });

    it('should require the service address', function () {
      expect(function () { createWorkClient({}, userApiClient); }).to.throw();
    });

    it('should reject an invalid service address', function () {
      expect(function () { createWorkClient({ service: 'http://' }, userApiClient); }).to.throw();
    });

    it('should require the user api client', function () {
      expect(function () { createWorkClient({ service: 'data:9220' }, null); }).to.throw();
    });
  });

  describe('createUploadPostprocessWork', function () {
    it('should POST the work to the data service with the server token', function (done) {
      createClient('127.0.0.1:' + port).createUploadPostprocessWork('user1', 'LEGACY_DATA_ADDED', availableTime, function (err, work) {
        expect(err).to.not.exist;
        expect(work).to.deep.equal({ id: 'work-1' });

        expect(requests).to.have.lengthOf(1);
        const request = requests[0];
        expect(request.method).to.equal('POST');
        expect(request.url).to.equal('/v1/work');
        expect(request.headers['x-tidepool-session-token']).to.equal(serverToken);
        expect(request.headers['content-type']).to.equal('application/json');
        expect(JSON.parse(request.body)).to.deep.equal({
          type: 'org.tidepool.data.upload.postprocess',
          groupId: 'org.tidepool.data.upload.postprocess:user1',
          serialId: 'org.tidepool.data.upload.postprocess:user1',
          processingTimeout: 300,
          processingAvailableTime: '2026-09-04T10:00:00.000Z',
          metadata: { userId: 'user1', reasons: ['LEGACY_DATA_ADDED'] }
        });
        done();
      });
    });

    it('should omit the available time of work to process immediately', function (done) {
      createClient('127.0.0.1:' + port).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
        expect(err).to.not.exist;
        expect(requests).to.have.lengthOf(1);
        const create = JSON.parse(requests[0].body);
        expect(create).to.not.have.property('processingAvailableTime');
        expect(create.metadata.reasons).to.deep.equal(['UPLOAD_COMPLETED']);
        done();
      });
    });

    it('should accept the service address with a scheme', function (done) {
      createClient('http://127.0.0.1:' + port).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
        expect(err).to.not.exist;
        expect(requests).to.have.lengthOf(1);
        expect(requests[0].url).to.equal('/v1/work');
        done();
      });
    });

    it('should report an unexpected status as an error', function (done) {
      respond = function (res) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'invalid-work' }));
      };
      createClient('127.0.0.1:' + port).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err, work) {
        expect(err).to.exist;
        expect(err.statusCode).to.equal(400);
        expect(err.message).to.deep.equal({ code: 'invalid-work' });
        expect(work).to.not.exist;
        done();
      });
    });

    it('should report a failure to get the server token without calling the data service', function (done) {
      const tokenError = { statusCode: 503, message: 'No hosts available' };
      const failing = { withServerToken: function (cb) { cb(tokenError); } };
      createWorkClient({ service: '127.0.0.1:' + port }, failing).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
        expect(err).to.equal(tokenError);
        expect(requests).to.be.empty;
        done();
      });
    });

    it('should report a data service that cannot be reached', function (done) {
      const unreachable = http.createServer();
      unreachable.listen(0, '127.0.0.1', function () {
        const closedPort = unreachable.address().port;
        unreachable.close(function () {
          createClient('127.0.0.1:' + closedPort).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
            expect(err).to.exist;
            expect(err.code).to.equal('ECONNREFUSED');
            done();
          });
        });
      });
    });

    it('should time out on a data service that does not answer', function (done) {
      respond = function () {};
      createClient('127.0.0.1:' + port, { timeout: 200 }).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
        expect(err).to.exist;
        expect(err.code).to.equal('ECONNABORTED');
        expect(requests).to.have.lengthOf(1);
        done();
      });
    });

    it('should create the work and call back once when the server token is delivered twice', function (done) {
      const twice = {
        withServerToken: function (cb) {
          cb(null, serverToken);
          cb(null, serverToken);
        }
      };
      let calls = 0;
      createWorkClient({ service: '127.0.0.1:' + port }, twice).createUploadPostprocessWork('user1', 'UPLOAD_COMPLETED', null, function (err) {
        ++calls;
        expect(err).to.not.exist;
        setTimeout(function () {
          expect(calls).to.equal(1);
          expect(requests).to.have.lengthOf(1);
          done();
        }, 50);
      });
    });
  });
});
