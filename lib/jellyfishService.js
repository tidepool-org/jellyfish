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

const { createTerminus, HealthCheckError } = require('@godaddy/terminus');

var fs = require('fs');

var log = require('./log.js')('jellyfishService.js');

var async = require('async');
var schemaEnv = require('./schema/schemaEnv.js');
var loop = require('./schema/loop.js');
var express = require('express');
var compression = require('compression');
var bodyparser = require('body-parser');
var util = require('util');
var _ = require('lodash');

// How long terminus waits after the signal before it stops the server
const shutdownDelayMs = 5 * 1000;

// Kubernetes kills the pod 30 seconds, its default termination grace period, after it starts
// terminating it, and the chart spends the first 15 of them in a preStop hook before the signal:
// the shutdown completes within this long of the signal, which leaves a margin for the process
// to exit.
const defaultShutdownTimeoutMs = 12 * 1000;

var jellyfishService = function(envConfig, mongoClient, seagullClient, userApiClient, gatekeeperClient, workClient) {
  var app, servicePort;
  //create the server depending on the type
  if (envConfig.httpPort != null) {
    servicePort = envConfig.httpPort;
    app = createServer(
      _.extend({ name: 'TidepoolJellyfishHttp'}, envConfig),
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient,
      workClient
    );
  } else if (envConfig.httpsPort != null) {
    servicePort = envConfig.httpsPort;
    app = createServer(
      _.extend({ name: 'TidepoolJellyfishHttps'}, envConfig),
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient,
      workClient
    );
  }

  // The shutdown runs to a single deadline: once the server stops, the uploads being handled have
  // until then to be answered, and the upload postprocess work created once they are has whatever
  // time is left.
  const shutdownTimeout = envConfig.shutdownTimeout != null ? envConfig.shutdownTimeout : defaultShutdownTimeoutMs;
  let shutdownDeadline;

  function beforeShutdown() {
    shutdownDeadline = Date.now() + shutdownTimeout;
    // avoid running into any race conditions
    // https://github.com/godaddy/terminus#how-to-set-terminus-up-with-kubernetes
    return new Promise(resolve => setTimeout(resolve, shutdownDelayMs));
  }

  // Work items are created after upload response is sent, so work creation requests may still be in
  // flight once the server has stopped: wait for it, until the shutdown deadline, and report what
  // is abandoned.
  async function onSignal() {
    let timer;
    const expired = new Promise(resolve => { timer = setTimeout(resolve, Math.max(shutdownDeadline - Date.now(), 0)); });
    await Promise.race([workClient.whenIdle(), expired]);
    clearTimeout(timer);
    if (workClient.inFlight() > 0) {
      log.error('Shutting down with %d upload postprocess work request(s) in flight', workClient.inFlight());
    }
  }

  async function healthCheck() {
    if (!mongoClient.healthCheck()) {
      throw new HealthCheckError('Database Error', ['Failed to connect to MongoDB']);
    }
  }

  var serviceManager = {
    theServer: null,

    stopService: function (app) {
      log.info('Stopping the Jellyfish API server');
      this.theServer.close();
    },

    // startService calls back with the port bound, which port 0 leaves to the system to pick.
    startService: function (app, servicePort, cb) {
      if (envConfig.httpPort != null) {
        var http = require('http');
        this.theServer = http.createServer(app);
      } else if (envConfig.httpsPort != null) {
        var https = require('https');
        this.theServer = https.createServer(envConfig.httpsConfig, app);
      }
      if(this.theServer) {
        var server = this.theServer;
        server.listen(servicePort, function () {
          log.info('Jellyfish API server serving on port[%s]', server.address().port);
          if (cb != null) {
            cb(null, server.address().port);
          }
        });
        this.theServer.keepAliveTimeout = 151 * 1000;
        this.theServer.headersTimeout = 155 * 1000; // This should be bigger than `keepAliveTimeout + your server's expected response time` = 61 * 1000;

        createTerminus(this.theServer, {
          signals: ['SIGTERM', 'SIGINT', 'SIGHUP'],
          healthChecks: {
            '/status': healthCheck
          },
          // how long the server waits for the requests being handled once it stops, before it
          // drops their connections
          timeout: Math.max(shutdownTimeout - shutdownDelayMs, 0),
          beforeShutdown,
          onSignal,
        });
      }
    }
  };

  return {
    close : serviceManager.stopService.bind(serviceManager, app),
    start : serviceManager.startService.bind(serviceManager, app, servicePort)
  };
};

var jsonp = function(response) {
  return function(error, data) {
    if(error) {
      log.warn(error, 'an error occurred!?');
      response.status(500).jsonp({error: error});
      return;
    }
    response.jsonp(data);
  };
};


function createServer(serverConfig, mongoClient, seagullClient, userApiClient, gatekeeperClient, workClient){

  // this is a little weird because we get a client and we also require it, but
  // in this case we're getting a sibling of the client we're passed in
  var middleware = require('user-api-client').middleware;
  var checkToken = middleware.expressify(middleware.checkToken(userApiClient));
  var streamDAO = require('./streamDAO.js')(mongoClient);
  var dataBroker = require('./dataBroker.js')(streamDAO, workClient);

  function getPrivatePair(userid, callback) {
    async.waterfall(
      [
        function(cb) {
          userApiClient.withServerToken(cb);
        },
        function(token, cb) {
          seagullClient.getPrivatePair(userid, 'uploads', token, cb);
        }
      ],
      function(err, privatePair) {
        if (err != null) {
          return callback(err);
        }
        callback(null, privatePair);
      }
    );
  }

  log.info('Creating server[%s]', serverConfig.name);
  var app = express();
  var errorHandler = require('errorhandler');

  app.use(compression());
  app.use(bodyparser.json({ limit: '4mb' }));
  if (process.env.NODE_ENV == "development") {
    app.use(errorHandler({ dumpExceptions: true, showStack: true }));
  }

  app.get('/info', function(request, response) {
    log.info('Handling versions request');

    var body = {
      auth: {
        realm: schemaEnv.authRealm,
        url: schemaEnv.authUrl,
      },
      versions: {
        uploaderMinimum : schemaEnv.minimumUploaderVersion,
        loop: {
          minimumSupported: loop.minimumVersion,
          criticalUpdateNeeded: loop.criticalUpdateVersions,
        }
      }
    };

    response.status(200).send(body);
  });

  /*
    send the actual ingested data to the platform
  */
  app.post(
    '/data/?:groupId?',
    checkToken,
    function(request, response) {
      var userid = request._tokendata.userid;

      var array = request.body;

      if (typeof(array) !== 'object') {
        return response.status(400).send(util.format('Expected an object body, got[%s]', typeof(array)));
      }

      if (!Array.isArray(array)) {
        array = [array];
      }

      var count = 0;
      var duplicates = [];
      var stored = [];

      let datasetUserId;

      async.waterfall(
        [
          function(cb) {
            // if no groupId was specified, just continue to upload for the
            // connected user
            if (!request.params.groupId) {
              return cb(null, userid);
            }

            gatekeeperClient.userInGroup(userid, request.params.groupId, function(err, perms) {
              if (err && err.statusCode !== 404) {
                return cb(err);
              }

              if (perms && (perms.upload || perms.root)) {
                return cb(null, request.params.groupId);
              }

              cb({
                statusCode: 403,
                message: 'You don\'t have rights to upload to that account.'
              });
            });
          },
          function(userId, cb) {
            getPrivatePair(userId, function(err, privatePair) {
              cb(err, userId, privatePair ? privatePair.id : null);
            });
          },
          function(userId, groupId, cb) {
            datasetUserId = userId;

            async.mapSeries(
              array,
              function(obj, cb) {
                obj._userId = userId;
                obj._groupId = groupId;
                dataBroker.addDatum(obj, function(err, written) {
                  if (err != null) {
                    if (err.errorCode === 'duplicate') {
                      duplicates.push(count);
                      err = null;
                    } else {
                      err.dataIndex = count;
                    }
                  }
                  if (err == null) {
                    stored.push(obj);
                  } else if (written != null) {
                    stored.push(...written);
                  }
                  ++count;
                  cb(err);
                });
              },
              cb
            );
          }
        ],
        function(err) {
          var groupMessage = request.params.groupId ? ('To group[' + request.params.groupId + ']') : '';
          // Sending throws on an error the response cannot serialize. The data stored still needs
          // its postprocess work, so the exception is answered here instead of escaping.
          try {
            if (err != null) {
              if (err.statusCode != null) {
                response.status(err.statusCode).send(err);
              } else {
                log.warn(err, 'Problem uploading for user[%s]. %s', userid, groupMessage);
                response.status(500).send({ statusCode: 500, message: 'Problem uploading data', dataIndex: err.dataIndex });
              }
            } else {
              response.status(200).send(duplicates);
            }
          } catch (sendErr) {
            log.error(sendErr, 'Problem answering upload for user[%s]. %s', userid, groupMessage);
            if (!response.headersSent) {
              response.status(500).send({ statusCode: 500, message: 'Problem uploading data' });
            }
          }

          // The work is created once the response is sent, so that the data service never
          // delays the uploader.
          dataBroker.createUploadPostprocessWork(datasetUserId, array, stored, err, _.noop);
        }
      );
    }
  );

  return app;
}

module.exports = jellyfishService;
