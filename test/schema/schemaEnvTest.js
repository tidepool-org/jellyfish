/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2024, Tidepool Project
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

/* global describe, before, beforeEach, it, after */

'use strict';

var expect = require('salinity').expect;
var misc = require('../../lib/misc.js');
var fs = require('fs');

describe('schema/schemaEnv.js', function () {
  const env = Object.assign({}, process.env);
  const POD_NAMESPACE = 'test';
  const TIDEPOOL_SERVER_SECRET = 'some kinda secret goes here I guess';
  const USER_IDS = ['123', '456', 'ddbs', 'blahblah'];
  const filePath = `${__dirname}/../../lib/${POD_NAMESPACE}_user_ids.json`;

  function setupFile(path, data, env, secret) {
    misc.encryptArrayToFile(data, path, env, secret);
  }

  function tearDownFile(path) {
    fs.unlinkSync(path);
  }

  before((done) => {
    process.env.POD_NAMESPACE = POD_NAMESPACE;
    process.env.TIDEPOOL_SERVER_SECRET = TIDEPOOL_SERVER_SECRET;
    setupFile(filePath, USER_IDS, POD_NAMESPACE, TIDEPOOL_SERVER_SECRET);
    done();
  });

  after((done) => {
    process.env = env;
    tearDownFile(filePath);
    done();
  });

  it('file present gets stored platform users', function (done) {
    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    expect(schemaEnv.platformUserIds).to.deep.equal(USER_IDS);
    done();
  });
});
