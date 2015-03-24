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
  var hakken = lifecycle.add('hakken', require('hakken')(config.discovery, log).client());

  var httpClient = amoeba.httpClient();

  var userApiClient = require('user-api-client').client(
    config.userApi,
    lifecycle.add('user-api-watch', hakken.watchFromConfig(config.userApi.serviceSpec))
  );

  var seagullClient = require('tidepool-seagull-client')(
    lifecycle.add('seagull-watch', hakken.watchFromConfig(config.seagull.serviceSpec)),
    {},
    httpClient
  );

  var gatekeeper = require('tidepool-gatekeeper');
  var gatekeeperClient = gatekeeper.client(
    httpClient,
    userApiClient.withServerToken.bind(userApiClient),
    lifecycle.add('gatekeeper-watch', hakken.watchFromConfig(config.gatekeeper.serviceSpec))
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

  lifecycle.add(
  'servicePublish!',
  {
    start: function(cb) {
      var serviceDescriptor = { service: config.serviceName };
      if (config.httpsPort != null) {
        serviceDescriptor.host = config.publishHost + ':' + config.httpsPort;
        serviceDescriptor.protocol = 'https';
      } else if (config.httpPort != null) {
        serviceDescriptor.host = config.publishHost + ':' + config.httpPort;
        serviceDescriptor.protocol = 'http';
      }

      log.info('Publishing service[%j]', serviceDescriptor);
      hakken.publish(serviceDescriptor);

      if (cb != null) {
        cb();
      }
    },
    close: function(cb) {
      log.warn('Calling publish close function');
      if (cb != null) {
        cb();
      }
      setTimeout(process.exit.bind(0), 2000);
    }
  });

  lifecycle.start();
  lifecycle.join();

})();
