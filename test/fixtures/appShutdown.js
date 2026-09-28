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

'use strict';

// Run the real application in a child process, replacing only its external services. Keeping the
// app's startup and signal handlers intact catches conflicts between shutdown coordinators.
function start() {
  function replaceModule(name, value) {
    const path = require.resolve(name);
    require.cache[path] = { id: path, filename: path, loaded: true, exports: value };
  }

  replaceModule('../../env.js', {
    httpPort: 0,
    // the 5 second terminus delay, then 3 seconds for the uploads and their work
    shutdownTimeout: 8000,
    userApi: {}, seagull: {}, gatekeeper: {}, mongo: {},
    data: { service: '127.0.0.1:1' }
  });
  const userApi = require('user-api-client');
  replaceModule('user-api-client', Object.assign({}, userApi, {
    client: function() {
      return {
        checkToken: function(token, cb) { cb(null, { userid: 'review-user' }); },
        withServerToken: function(cb) { cb(null, 'synthetic-token'); }
      };
    }
  }));
  replaceModule('tidepool-seagull-client', function() {
    return { getPrivatePair: function(userid, name, token, cb) { cb(null, { id: 'private-user' }); } };
  });
  replaceModule('tidepool-gatekeeper', { client: function() { return {}; } });
  replaceModule('../../lib/mongo/mongoClient.js', function() {
    return { start: function() {}, healthCheck: function() { return true; } };
  });
  // Forked with 'hold-writes', the store writes a datum only when told to complete the write.
  const holdWrites = process.argv.includes('hold-writes');
  let completeWrite;
  replaceModule('../../lib/streamDAO.js', function() {
    return {
      addOrUpdateDatum: function(datum, cb) {
        if (!holdWrites) { return cb(null, datum); }
        completeWrite = function() { cb(null, datum); };
        process.send({ event: 'write-started' });
      }
    };
  });

  let answerWork;
  const createWorkClient = require('../../lib/workClient.js');
  replaceModule('../../lib/workClient.js', function(config, userApiClient) {
    const client = createWorkClient(config, userApiClient, function(options, cb) {
      answerWork = cb;
      process.send({ event: 'work-started' });
    });
    const whenIdle = client.whenIdle;
    client.whenIdle = function() {
      process.send({ event: 'waiting-for-work', inFlight: client.inFlight() });
      return whenIdle();
    };
    return client;
  });

  // Report the ephemeral port without changing which component starts or closes the server.
  const createService = require('../../lib/jellyfishService.js');
  replaceModule('../../lib/jellyfishService.js', function(...args) {
    const service = createService(...args);
    const startService = service.start;
    service.start = function() {
      startService(function(err, port) {
        if (err) { throw err; }
        process.send({ event: 'ready', port: port });
      });
    };
    return service;
  });
  process.on('message', function(message) {
    if (message === 'complete-write') {
      completeWrite();
    } else if (message === 'complete-work') {
      process.send({ event: 'work-created' });
      answerWork(null, { statusCode: 201 }, { id: 'work-1' });
    } else if (message === 'crash') {
      throw new Error('synthetic uncaught exception');
    }
  });

  require('../../app.js');
}

// Mocha recursively loads fixtures; only start when forked as the entry point.
if (require.main === module) {
  start();
}
