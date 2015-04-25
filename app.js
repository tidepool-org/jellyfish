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
  var hakken = require('hakken')(config.discovery, log).client();

  /*
   * user API
   */
  var userApiWatch = hakken.watchFromConfig(config.userApi.serviceSpec);
  userApiWatch.start();

  var userApiClient = require('user-api-client').client(
    config.userApi,
    userApiWatch
  );

  /*
   * seagull API
   */
  var seagullApiWatch = hakken.watchFromConfig(config.seagull.serviceSpec);
  seagullApiWatch.start();

  var seagullClient = require('tidepool-seagull-client')(
    seagullApiWatch,
    {},
    httpClient
  );

  /*
   * gatekeeper API
   */
  var gatekeeperApiWatch = hakken.watchFromConfig(config.gatekeeper.serviceSpec);
  gatekeeperApiWatch.start();

  var gatekeeper = require('tidepool-gatekeeper');
  var gatekeeperClient = gatekeeper.client(
    httpClient,
    userApiClient.withServerToken.bind(userApiClient),
    gatekeeperApiWatch
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

   //let's get this party started
  service.start(function (err) {
    if (err != null) {
      throw err;
    }

    var serviceDescriptor = { service: config.serviceName };
    if (config.httpsPort != null) {
      serviceDescriptor.host = config.publishHost + ':' + config.httpsPort;
      serviceDescriptor.protocol = 'https';
    } else if (config.httpPort != null) {
      serviceDescriptor.host = config.publishHost + ':' + config.httpPort;
      serviceDescriptor.protocol = 'http';
    }

    log.info('Publishing service[%j]', serviceDescriptor);
    hakkenClient.publish(serviceDescriptor);
  });


  process.on('uncaughtException', function(err){
    log.error(err, 'Uncaught exception bubbled all the way up!');
  });

})();
