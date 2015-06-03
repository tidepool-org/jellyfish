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
   * A JSON object that describes where to store intermediate files (data files to be processed)
   * Known types are 'local' and 'sandcastle'.
   *
   * 'local' is the default and just stores files locally
   */
  env.storage = JSON.parse(config.fromEnvironment("FILE_STORAGE", '{ "type": "local", "storageDir":"./data" }'));

  env.seagull = {
    // The config object to discover seagull.  This is just passed through to hakken.watchFromConfig()
    serviceSpec: JSON.parse(config.fromEnvironment("SEAGULL_SERVICE"))
  };

  env.mongo = {
    // A standard Mongo connection string used to connect to Mongo, of all things
    connectionString: config.fromEnvironment('MONGO_CONNECTION_STRING', 'mongodb://localhost/streams')
  };

  env.discovery = {
    host: config.fromEnvironment('DISCOVERY_HOST')
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
