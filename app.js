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

<<<<<<< HEAD
var amoeba = require('amoeba');
var httpClient = amoeba.httpClient();

var config = require('./env.js');
var log = require('./lib/log.js')('app.js');
=======
var fs = require('fs');

var async = require('async');
var express = require('express');
var compression = require('compression');
var bodyparser = require('body-parser');
var util = require('util');

var amoeba = require('amoeba');

var config = require('./env.js');
var log = require('./lib/log.js')('app.js');

var jsonp = function(response) {
  return function(error, data) {
    if(error) {
      log.warn(error, 'an error occurred!?');
      response.jsonp(500, {error: error});
      return;
    }
    response.jsonp(data);
  };
};
>>>>>>> kjq/updateDeps

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

<<<<<<< HEAD
  var service = require('./lib/jellyfishService.js')(
    config,
    mongoClient,
    seagullClient,
    userApiClient,
    gatekeeperClient
=======
  var tasks = require('./lib/tasks.js')(mongoClient);
  var carelinkUploadFlow = require('./lib/carelinkUploadFlow.js')({ storageDir: config.tempStorage }, tasks);
  var dataBroker = require('./lib/dataBroker.js')(require('./lib/streamDAO.js')(mongoClient));

  function lookupGroupId(userid, callback) {
    async.waterfall(
      [
        function(cb) {
          userApiClient.withServerToken(cb);
        },
        function(token, cb) {
          seagullClient.getPrivatePair(userid, 'uploads', token, cb);
        }
      ],
      function(err, hashPair) {
        if (err != null) {
          return callback(err);
        }

        callback(null, hashPair == null ? null : hashPair.id);
      }
    );
  }

  var app = express();

  app.use(compression());
  app.use(bodyparser.json({ limit: '4mb' }));

  app.get('/status', function(request, response) {
    response.status(200).send('OK');
  });

  /*
   * Deals with Carelink data fetching it and then storing the file
   */
  app.post(
    '/v1/device/upload/cl',
    checkToken,
    function(request, response) {
      lookupGroupId(request._tokendata.userid, function(err, groupId) {
        if (err != null) {
          if (err.statusCode == null) {
            log.warn(err, 'Failed to get private pair for user[%s]', request._tokendata.userid);
            return response.status(500).send('Error private pair for user');
          } else {
            log.warn(err, 'Failed to get private pair for user[%s] with error [%s]', request._tokendata.userid, err);
            return response.status(err.statusCode).send(err);
          }
        }

        if (groupId == null) {
          log.warn('Unable to get hashPair; something is broken...');
          return response.status(503);
        }
        //get the form then
        carelinkUploadFlow.ingest(request, { groupId: groupId }, jsonp(response));
      });
    }
  );

  // This is actually a potential leak because it allows *any* logged in user to see the status of any task.
  // It's just the status though, and this whole thing needs to get redone at some point anyway, so I'm leaving it.
  app.get(
    '/v1/synctasks/:id',
    checkToken,
    function(request, response) {
      tasks.get(request.params.id, jsonp(response));
    }
>>>>>>> kjq/updateDeps
  );
  lifecycle.add('jellyfishService', service);

  process.on('uncaughtException', function(err){
    log.error(err, 'Uncaught exception bubbled all the way up!');
  });

<<<<<<< HEAD
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
=======
  /*
   * Send the actual ingested data to the platform
   */
  app.post(
    '/data/?:groupId?',
    checkToken,
    function(req, res) {
      var userid = req._tokendata.userid;
>>>>>>> kjq/updateDeps

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

<<<<<<< HEAD
  lifecycle.start();
  lifecycle.join();
=======
  if (config.httpPort != null) {
    require('http').createServer(app).listen(config.httpPort, function(){
      log.info('Api server running on port[%s]', config.httpPort);
    });
  }

  if (config.httpsPort != null) {
    require('https').createServer(config.httpsConfig, app).listen(config.httpsPort, function(){
      log.info('Api server listening for HTTPS on port[%s]', config.httpsPort);
    });
  }

  if (config.discovery != null) {
    var serviceDescriptor = { service: config.serviceName };
    if (config.httpsPort != null) {
      serviceDescriptor.host = config.publishHost + ':' + config.httpsPort;
      serviceDescriptor.protocol = 'https';
    }
    else if (config.httpPort != null) {
      serviceDescriptor.host = config.publishHost + ':' + config.httpPort;
      serviceDescriptor.protocol = 'http';
    }
>>>>>>> kjq/updateDeps

})();
