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

var _ = require('lodash');
var axios = require('axios');
var amoeba = require('amoeba');
var pre = amoeba.pre;

var log = require('./log.js')('workClient.js');

// The work type the platform data service processes after an upload: it recalculates the summaries
// of the user and requests an EHR synchronization.
const workType = 'org.tidepool.data.upload.postprocess';

// Matches the processing timeout of the work created by the platform's own producers
const processingTimeoutSeconds = 300;

// Creating work is a single insert on the data service, and the work is created after the upload
// is answered, so the timeout only bounds how long a data service that stopped answering holds a
// socket for.
const defaultRequestTimeoutMs = 30 * 1000;

// parseService accepts the address of the data service with or without a scheme: the jellyfish
// *_CLIENT_ADDRESS variables are host:port, whereas the platform services are given
// 'http://data:9220'. Returns the host object amoeba's httpClient formats the request URL from.
function parseService(service) {
  const url = new URL(service.includes('://') ? service : 'http://' + service);
  return { protocol: url.protocol.replace(/:$/, ''), host: url.host };
}

// createRequest returns the request function amoeba's httpClient issues its requests with: axios,
// as amoeba's own, plus a timeout, which amoeba does not set. It maps the options this client
// uses, not amoeba's basic auth. The callback runs outside the promise chain, so an exception
// thrown by the continuation surfaces as such, instead of being caught and reported as a failed
// request.
function createRequest(timeout) {
  return function (options, cb) {
    axios(_.assign(_.omit(options, ['body', 'qs']), { data: options.body, params: options.qs, timeout }))
      .then(
        function (res) {
          process.nextTick(cb, null, { statusCode: res.status, headers: res.headers, body: res.data }, res.data ? res.data : null);
        },
        function (err) {
          process.nextTick(cb, err);
        }
      );
  };
}

// request, the function amoeba's httpClient issues requests with, defaults to createRequest above.
module.exports = function (config, userApiClient, request) {
  pre.notNull(config, 'data service config must be specified');
  pre.hasProperty(config, 'service', 'data service address must be specified');
  pre.notNull(userApiClient, 'userApiClient must be specified');

  const service = parseService(config.service);
  const timeout = config.timeout != null ? config.timeout : defaultRequestTimeoutMs;
  log.info('Creating upload postprocess work on data service[%s://%s]', service.protocol, service.host);

  if (request == null) {
    request = createRequest(timeout);
  }

  const httpClient = amoeba.httpClient({
    hostGetter: {
      get: function () {
        return [service];
      }
    }
  }, request);

  // The work creations not answered yet, and who waits for them to complete
  let inFlight = 0;
  let idleWaiters = [];

  function completed() {
    if (--inFlight === 0) {
      idleWaiters.forEach(resolve => resolve());
      idleWaiters = [];
    }
  }

  return {
    // createUploadPostprocessWork reports a change to the data of the user to the platform data
    // service. The work is keyed by the user, so platform serializes it with any other work for
    // the user and absorbs it into work already waiting: reporting the same change repeatedly is
    // processed once. A deferred availableTime is honored until a reason that does not defer
    // (any but LEGACY_DATA_ADDED) arrives for the user.
    //
    // 201 reports the work created, and 204 that equivalent work waits already, which the work is
    // deduplicated into; any other status is an error.
    createUploadPostprocessWork: function (userId, reason, availableTime, cb) {
      ++inFlight;
      // user-api-client 0.5.2 calls back twice when the server token is fetched while another
      // caller is waiting for it, which would create the work twice and call cb twice.
      userApiClient.withServerToken(_.once(function (err, token) {
        if (err != null) {
          completed();
          return cb(err);
        }

        const id = workType + ':' + userId;
        const create = {
          type: workType,
          groupId: id,
          serialId: id,
          processingTimeout: processingTimeoutSeconds,
          metadata: { userId: userId, reasons: [reason] }
        };
        if (availableTime != null) {
          create.processingAvailableTime = availableTime.toISOString();
        }

        httpClient.requestToPath('/v1/work')
          .withMethod('POST')
          .withToken(token)
          .withJson(create)
          .whenStatusPassBody([201, 204])
          .go(function (err, work) {
            completed();
            cb(err, work);
          });
      }));
    },

    // inFlight reports the number of work creations not answered yet.
    inFlight: function () {
      return inFlight;
    },

    // whenIdle resolves once no work creation is in flight. The work is created after the upload
    // is answered, so this is how a shutdown waits for it.
    whenIdle: function () {
      if (inFlight === 0) {
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        idleWaiters.push(resolve);
      });
    }
  };
};
