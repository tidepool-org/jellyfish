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

  function setupFile(env, secret) {
    const jsonFilePath = `${__dirname}/user_ids/${POD_NAMESPACE}.json`;
    misc.encryptUserIds(jsonFilePath, env, secret);
  }

  function tearDownFile() {
    fs.unlinkSync(
      `${__dirname}/../../lib/platform_users/${POD_NAMESPACE}.json.enc`
    );
  }

  it('will throw an error if the environment specific user_ids file is not present', function (done) {
    process.env.POD_NAMESPACE = 'not_test';
    process.env.TIDEPOOL_SERVER_SECRET = TIDEPOOL_SERVER_SECRET;
    expect(() => require('../../lib/schema/schemaEnv.js')).to.throw();
    done();
  });

  it('will return the platform users as an unencrypted array', function (done) {
    process.env.POD_NAMESPACE = POD_NAMESPACE;
    process.env.TIDEPOOL_SERVER_SECRET = TIDEPOOL_SERVER_SECRET;
    setupFile(POD_NAMESPACE, TIDEPOOL_SERVER_SECRET);

    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    expect(schemaEnv.platformUserIds).to.deep.equal(USER_IDS);
    process.env = env;
    tearDownFile();
    done();
  });
});
