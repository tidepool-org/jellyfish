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

var amoeba = require('amoeba');

// The work type the platform data service processes after an upload: it recalculates the summaries
// of the user and, when a reason reports a completed upload, requests an EHR synchronization.
const workType = 'org.tidepool.data.upload.postprocess';

// Matches the processing timeout of the work created by the platform's own producers
const processingTimeoutSeconds = 300;

module.exports = function (config, userApiClient, httpClient) {
  if (httpClient == null) {
    httpClient = amoeba.httpClient({
      hostGetter: {
        get: function () {
          return [{ protocol: 'http', host: config.service }];
        }
      }
    });
  }

  return {
    // createUploadPostprocessWork reports a change to the data of the user to the platform data
    // service. The work is keyed by the user, so platform serializes it with any other work for
    // the user and absorbs it into work already waiting: reporting the same change repeatedly is
    // processed once. A deferred availableTime is honored until a reason that does not defer
    // (any but LEGACY_DATA_ADDED) arrives for the user.
    //
    // 201 reports the work created; 204 reports it was discarded as a duplicate.
    createUploadPostprocessWork: function (userId, reason, availableTime, cb) {
      userApiClient.withServerToken(function (err, token) {
        if (err != null) {
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
          .whenStatusPassBody(201)
          .whenStatusPassNull(204)
          .go(cb);
      });
    }
  };
};
