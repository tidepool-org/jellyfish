/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var _ = require('lodash');

var salinity = require('salinity');

var expect = salinity.expect;

var tasks = require('../lib/tasks.js')(null);

describe('tasks', function() {

  it('should return null if the task is null', function() {
    expect(tasks.sanitize(null)).to.be.nil;
  });

  it('should return the task with the any _id mapped to id', function() {
    var task = {_id: 'My Id'};
    var expectedTask = {id: task._id};
    expect(tasks.sanitize(task)).to.deep.equal(expectedTask);
  });

  it('should only return the tasks id, status, reason, and error', function() {
    var task = {extra: 'My Extra', _id: 'My Id', status: 'My Status', reason: 'My Reason', error: 'My Error', another: 'My Another'};
    var expectedTask = {id: task._id, status: task.status, reason: task.reason, error: task.error};
    expect(tasks.sanitize(task)).to.deep.equal(expectedTask);
  });
});
