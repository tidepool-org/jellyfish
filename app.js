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

var amoeba = require('amoeba');
var httpClient = amoeba.httpClient();

var config = require('./env.js');
var log = require('./lib/log.js')('app.js');

(function(){
  var lifecycle = amoeba.lifecycle();

  var httpClient = amoeba.httpClient();
  
  var userApiClient = require('user-api-client').client( config.userApi, {
    get: function() { return [{"protocol": "http", "host": config.userApi.service}] }
  }
  );

  var seagullClient = require('tidepool-seagull-client')(
    {
      get: function() { return [{"protocol": "http", "host": config.seagull.service}] }
    },
    {},
    httpClient
  );

  var gatekeeper = require('tidepool-gatekeeper');
  var gatekeeperClient = gatekeeper.client(
    httpClient,
    userApiClient.withServerToken.bind(userApiClient),
    {
      get: function() { return [{"protocol": "http", "host": config.gatekeeper.service}] }
    }
  );

  var mongoClient = require('./lib/mongo/mongoClient.js')(config.mongo);
  mongoClient.start();

  var service = require('./lib/jellyfishService.js')(
    config,
    mongoClient,
    seagullClient,
    userApiClient,
    gatekeeperClient
  );
  lifecycle.add('jellyfishService', service);

  process.on('uncaughtException', function(err){
    log.error(err, 'Uncaught exception bubbled all the way up!');
  });

  lifecycle.start();
  lifecycle.join();

})();
