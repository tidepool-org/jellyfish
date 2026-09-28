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

// generateSamples returns n copies of the sample five minutes apart, so that their ids differ
exports.generateSamples = function (sample, n) {
  const samples = [];
  const start = new Date(sample.time);
  for (let i = 0; i < n; i++) {
    samples.push(Object.assign({}, sample, { time: new Date(start.getTime() + i * 5 * 60 * 1000).toISOString() }));
  }
  return samples;
};
