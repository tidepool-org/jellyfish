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

var log = require('./log.js')('jellyfishService.js');

var async = require('async');
var env = require('../env.js');
var schemaEnv = require('./schema/schemaEnv.js');
var express = require('express');
var compression = require('compression');
var bodyparser = require('body-parser');
var Busboy = require('busboy');
var util = require('util');
var _ = require('lodash');

var jellyfishService = function(envConfig, mongoClient, seagullClient, userApiClient, gatekeeperClient) {
  var app, servicePort;
  //create the server depending on the type
  if (envConfig.httpPort != null) {
    servicePort = envConfig.httpPort;
    app = createServer(
      _.extend({ name: 'TidepoolJellyfishHttp'}, envConfig),
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient
    );
  } else if (envConfig.httpsPort != null) {
    servicePort = envConfig.httpsPort;
    app = createServer(
      _.extend({ name: 'TidepoolJellyfishHttps'}, envConfig),
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient
    );
  }

  var serviceManager = {
    theServer: null,

    stopService: function (app) {
      log.info('Stopping the Jellyfish API server');
      this.theServer.close();
    },

    startService: function (app, servicePort, cb) {
      log.info('Jellyfish API server serving on port[%s]', servicePort);
      if (envConfig.httpPort != null) {
        var http = require('http');
        this.theServer = http.createServer(app).listen(servicePort, cb);
      } else if (envConfig.httpsPort != null) {
        var https = require('https');
        this.theServer = https.createServer(envConfig.httpsConfig, app).listen(servicePort, cb);
      }
      if(this.theServer) {
        this.theServer.keepAliveTimeout = 151 * 1000;
        this.theServer.headersTimeout = 155 * 1000; // This should be bigger than `keepAliveTimeout + your server's expected response time` = 61 * 1000;
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


function createServer(serverConfig, mongoClient, seagullClient, userApiClient, gatekeeperClient){

  // this is a little weird because we get a client and we also require it, but
  // in this case we're getting a sibling of the client we're passed in
  var middleware = require('user-api-client').middleware;
  var checkToken = middleware.expressify(middleware.checkToken(userApiClient));
  var tasks = require('./tasks.js')(mongoClient);
  var dataBroker = require('./dataBroker.js')(require('./streamDAO.js')(mongoClient));

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

  app.use(compression());
  app.use(bodyparser.json({ limit: '4mb' }));

  app.get('/status', function(request, response) {
    response.status(200).send('OK');
  });

  app.get('/info', function(request, response) {
    log.info('Handling versions request');

    var expectedVersions = {
      versions: {
        uploaderMinimum : schemaEnv.minimumUploaderVersion
      }
    };

    response.status(200).send(expectedVersions);
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

      async.waterfall(
        [
          function(cb) {
            // if no groupId was specified, just continue to upload for the
            // connected user
            if (!request.params.groupId) {
              return cb(null, userid);
            }

            // get the groups for the logged-in user
            gatekeeperClient.groupsForUser(userid, function(err, groups) {
              if (err) {
                return cb(err);
              }

              // and check them all to see if we have upload permissions
              for (var groupId in groups) {
                var perms = groups[groupId];

                if (groupId === request.params.groupId && (perms.upload || perms.root)) {
                  return cb(null, groupId);
                }
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
            async.mapSeries(
              array,
              function(obj, cb) {
                obj._userId = userId;
                obj._groupId = groupId;
                dataBroker.addDatum(obj, function(err){
                  if (err != null) {
                    if (err.errorCode === 'duplicate') {
                      duplicates.push(count);
                      err = null;
                    } else {
                      err.dataIndex = count;
                    }
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
          if (err != null) {
            if (err.statusCode != null) {
              response.status(err.statusCode).send(err);
            } else {
              var groupMessage = request.params.groupId ? ('To group[' + request.params.groupId + ']') : '';
              log.warn(err, 'Problem uploading for user[%s]. %s', userid, groupMessage);
              response.status(500);
            }
          } else {
            response.status(200).send(duplicates);
          }
        }
      );
    }
  );

  return app;
}

module.exports = jellyfishService;
