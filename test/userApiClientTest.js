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

 /* global describe, before, after, it */

'use strict';

var http = require('http');

var async = require('async');
var expect = require('salinity').expect;
var userApi = require('user-api-client');

var wrapUserApiClient = require('../lib/userApiClient.js');

describe('userApiClient', function () {
  // A stand-in for the user API: it issues the server token, slowly enough for the callers to ask
  // for it while it is being fetched, and accepts any user token.
  let server;
  let port;

  before(function (done) {
    server = http.createServer(function (req, res) {
      if (req.url === '/serverlogin') {
        return setTimeout(function () {
          res.writeHead(200, { 'x-tidepool-session-token': 'server-token' });
          res.end();
        }, 20);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ userid: 'user1' }));
    });
    server.listen(0, '127.0.0.1', function () {
      port = server.address().port;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  it('should call back each caller once while the server token is being fetched', function (done) {
    const client = wrapUserApiClient(userApi.client({ serverName: 'jellyfish', serverSecret: 'secret' }, {
      get: function () { return [{ protocol: 'http', host: '127.0.0.1:' + port }]; }
    }));
    const calls = { first: 0, waterfall: 0, checkToken: 0, last: 0 };

    client.withServerToken(function () { ++calls.first; });
    // async throws when its callback is called a second time
    async.waterfall([function (cb) { client.withServerToken(cb); }], function () { ++calls.waterfall; });
    client.checkToken('user-token', function () { ++calls.checkToken; });
    client.withServerToken(function () { ++calls.last; });

    // every fetch of the server token, and the second token check, answered
    setTimeout(function () {
      expect(calls).to.deep.equal({ first: 1, waterfall: 1, checkToken: 1, last: 1 });
      done();
    }, 200);
  });
});
