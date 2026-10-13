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

// user-api-client 0.5.2 queues every caller after the first that needs the server token while it
// is being fetched twice, so it calls them back twice: checkToken would run the request handler
// twice, and an async callback throws on its second call, which stops the client calling back the
// callers queued behind it. Wrapping each callback of the client in _.once makes the second call a
// no-op.
module.exports = function (client) {
  return _.mapValues(client, function (method) {
    if (!_.isFunction(method)) {
      return method;
    }
    return function (...args) {
      if (_.isFunction(_.last(args))) {
        args[args.length - 1] = _.once(_.last(args));
      }
      return method.apply(client, args);
    };
  });
};
