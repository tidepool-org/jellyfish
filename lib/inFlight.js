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

// inFlight counts the operations started and not completed yet, which a shutdown waits for.
module.exports = function () {
  let count = 0;
  let idleWaiters = [];

  return {
    start: function () {
      ++count;
    },

    complete: function () {
      if (--count === 0) {
        idleWaiters.forEach(resolve => resolve());
        idleWaiters = [];
      }
    },

    count: function () {
      return count;
    },

    // whenIdle resolves once no operation is in flight.
    whenIdle: function () {
      if (count === 0) {
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        idleWaiters.push(resolve);
      });
    }
  };
};
