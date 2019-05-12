/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

var fs = require('fs');

var config = require('amoeba').config;

function maybeReplaceWithContentsOfFile(obj, field) {
  var potentialFile = obj[field];
  if (potentialFile != null && fs.existsSync(potentialFile)) {
    obj[field] = fs.readFileSync(potentialFile).toString();
  }
}

module.exports = (function () {
  var env = {};

  // The port to attach an HTTP listener, if null, no HTTP listener will be attached
  env.httpPort = process.env.PORT || null;

  // The port to attach an HTTPS listener, if null, no HTTPS listener will be attached
  env.httpsPort = config.fromEnvironment('HTTPS_PORT', null);

  // The https config to pass along to https.createServer.
  var theConfig = config.fromEnvironment('HTTPS_CONFIG', null);
  env.httpsConfig = null;
  if (theConfig != null) {
    env.httpsConfig = JSON.parse(theConfig);
    maybeReplaceWithContentsOfFile(env.httpsConfig, 'key');
    maybeReplaceWithContentsOfFile(env.httpsConfig, 'cert');
    maybeReplaceWithContentsOfFile(env.httpsConfig, 'pfx');
  }
  if (env.httpsPort != null && env.httpsConfig == null) {
    throw new Error('No https config provided, please set HTTPS_CONFIG with at least the certificate to use.');
  }

  if (env.httpPort == null && env.httpsPort == null) {
    throw new Error('Must specify either PORT or HTTPS_PORT in your environment.');
  }

  env.userApi = {
    // The config object to discover user-api.  This is just passed through to hakken.watchFromConfig()
    serviceSpec: JSON.parse(config.fromEnvironment("USER_API_SERVICE")),

    // Name of this server to pass to user-api when getting a server token
    serverName: config.fromEnvironment("SERVER_NAME", "jellyfish:default"),

    // The secret to use when getting a server token from user-api
    serverSecret: config.fromEnvironment("SERVER_SECRET")
  };

  env.gatekeeper = {
    // The config object to discover gatekeeper.  This is just passed through to hakken.watchFromConfig()
    serviceSpec: JSON.parse(config.fromEnvironment('GATEKEEPER_SERVICE'))
  };

  /**
   * Credentials for AWS.  Only required if env.storage.default is 'aws/s3'.
   *
   * The AWS_CREDENTIALS value should be a JSON string hash containing the
   * properties 'accessKeyId' and 'secretAccessKey'.
   *
   * An example of a complete AWS_CREDENTIALS value:
   *
   * '{"accessKeyId": "<your-access-key-id>", "secretAccessKey": "<your-secret-access-key>"}'
   */
  env.awsCredentials = JSON.parse(config.fromEnvironment('AWS_CREDENTIALS', '{}'));

  /**
   * A JSON object that describes where to store intermediate files (data files
   * to be processed).
   *
   * There are currently two known types of storage, 'local' and 'aws/s3'.
   *
   * The STORAGE_TYPES value should be a JSON string hash with one key/value pair
   * for each storage type. The key should be the name of the storage type and the
   * value should be a hash with the necessary configuration for the storage type.
   * Every hash MUST contain the type property.
   *
   * The 'local' storage type hash should be of the form:
   *
   * {"type": "local", "encryption": "aes256", "directory": "./data"}
   *
   * "type" - MUST be "local"
   * "encryption" - either "none" or "aes256"
   * "directory" - relative path to base directory for upload storage
   *
   * The 'aws/s3' storage type hash should be of the form:
   *
   * {"type": "aws/s3", "encryption": "aes256", "region": us-west-2", "bucket": "doesnotexist.tidepool.org"}
   *
   * "type" - MUST be "aws/s3"
   * "encryption" - either "none or "aes256"
   * "region" - AWS region associated with the AWS bucket (eg. "us-west-2")
   * "bucket" - AWS bucket for upload storage
   *
   * An example of a complete STORAGE_TYPES value:
   *
   * '{"local": {"type": "local", "encryption": "aes256", "directory": "./data"}, "aws/s3": {"type": "aws/s3", "encryption": "aes256", "region": "us-west-2", "bucket": "doesnotexist.tidepool.org"}}'
   *
   * The STORAGE_DEFAULT should be the storage type ('local' or 'aws/s3') used
   * for new uploads. Existing uploads remember their storage location for
   * future downloads.
   */
  env.storage = {
    types: JSON.parse(config.fromEnvironment('STORAGE_TYPES', '{"local": {"type": "local", "encryption": "none", "directory": "./data"}}')),
    default: config.fromEnvironment('STORAGE_DEFAULT', 'local')
  };

  // Configurable salt for encryption
  env.saltDeploy = config.fromEnvironment('SALT_DEPLOY');

  env.seagull = {
    // The config object to discover seagull.  This is just passed through to hakken.watchFromConfig()
    serviceSpec: JSON.parse(config.fromEnvironment("SEAGULL_SERVICE"))
  };

  env.mongo = {
    // A standard Mongo connection string used to connect to Mongo, of all things
    connectionString: config.fromEnvironment('MONGO_CONNECTION_STRING', 'mongodb://localhost/data')
  };

  env.discovery = {
    host: config.fromEnvironment('DISCOVERY_HOST'),
    skipHakken: config.fromEnvironment('SKIP_HAKKEN', false)
  };

  // The service name to expose to discovery
  env.serviceName = config.fromEnvironment('SERVICE_NAME', 'jellyfish');

  // The local host to expose to discovery
  env.publishHost = config.fromEnvironment('PUBLISH_HOST');

  // Location of temporary storage, these are things like uploaded dexcom files and
  // the files used to communicate errors from child processes back to the main process.
  env.tempStorage = config.fromEnvironment('TEMP_STORAGE', '/tmp/jellyfish');

  // Serve static build of client app from this directory
  // (use "dist" if you haven't changed default build directory)
  env.serveStatic = config.fromEnvironment('SERVE_STATIC', null);
  if (env.serveStatic === '') {
    env.serveStatic = null;
  }

  return env;
})();
