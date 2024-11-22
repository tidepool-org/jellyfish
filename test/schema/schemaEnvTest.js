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
  const USER_ID_SALT = 'some kinda salt goes here I guess';
  const USER_IDS = ['123', '456', 'ddbs', 'blahblah'];
  const envJSONFile = `${__dirname}/../../lib/platform_users/${POD_NAMESPACE}.json`;
  const envJSONHashedFile = `${__dirname}/../../lib/platform_users/${POD_NAMESPACE}_hashed.json`;

  function setupFile(env, salt) {
    fs.writeFileSync(envJSONFile, JSON.stringify(USER_IDS));
    misc.hashUserIds(env, salt);
  }

  function tearDownFile() {
    fs.unlinkSync(envJSONFile);
    fs.unlinkSync(envJSONHashedFile);
    process.env = env;
  }

  it('will throw an error if the environment specific user_ids file is not present', function (done) {
    process.env.POD_NAMESPACE = 'not_test';
    process.env.USER_ID_SALT = USER_ID_SALT;
    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    expect(schemaEnv.isPlatformUserId).to.throw;
    done();
  });

  it('will throw an error if the salt is not set', function (done) {
    process.env.POD_NAMESPACE = POD_NAMESPACE;
    process.env.USER_ID_SALT = null;
    setupFile(POD_NAMESPACE, USER_ID_SALT);

    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    expect(schemaEnv.isPlatformUserId('not-a-user')).to.throw;
    tearDownFile();
    done();
  });

  it('will return false when the user is not a platform user', function (done) {
    process.env.POD_NAMESPACE = POD_NAMESPACE;
    process.env.USER_ID_SALT = USER_ID_SALT;
    setupFile(POD_NAMESPACE, USER_ID_SALT);
    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    expect(schemaEnv.isPlatformUserId('not-a-user')).to.be.false;
    tearDownFile();
    done();
  });

  it('will return true when the user is a platform user', function (done) {
    process.env.POD_NAMESPACE = POD_NAMESPACE;
    process.env.USER_ID_SALT = USER_ID_SALT;
    setupFile(POD_NAMESPACE, USER_ID_SALT);
    var schemaEnv = require('../../lib/schema/schemaEnv.js');
    const randomUserId = Math.floor(Math.random() * USER_IDS.length);
    expect(schemaEnv.isPlatformUserId(USER_IDS[randomUserId])).to.be.true;
    tearDownFile();
    done();
  });
});
