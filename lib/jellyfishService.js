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

var async = require('async');
var express = require('express');
var compression = require('compression');
var bodyparser = require('body-parser');
var path = require('path');
var util = require('util');
var log = require('./log.js')('jellyfishService.js');
var _ = require('lodash');

var jellyfishService = function(envConfig, mongoClient, seagullClient, userApiClient, gatekeeperClient) {
  var app, servicePort;
  //create the server depending on the type
  if (envConfig.httpPort != null) {
    servicePort = envConfig.httpPort;
    app = createServer(
      { name: 'TidepoolJellyfishHttp' },
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient
    );
  } else if (envConfig.httpsPort != null) {
    servicePort = envConfig.httpsPort;
    app = createServer(
      _.extend({ name: 'TidepoolJellyfishHttps'}, envConfig.httpsConfig),
      mongoClient,
      seagullClient,
      userApiClient,
      gatekeeperClient
    );
  }

  log.warn("Got app: ", app);

  var serviceManager = {
    theServer: null,

    stopService: function (app) {
      log.info('Stopping the Jellyfish API server');
      this.theServer.close();
    },

    startService: function (app, servicePort, cb) {
      log.info('Jellyfish API server serving on port[%s]', servicePort);
      this.theServer = app.listen(servicePort, cb);
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
      response.jsonp(500, {error: error});
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



  log.info('Creating server[%s]', serverConfig.name);
  var app = express();

  app.use(compression());
  app.use(bodyparser.json({ limit: '4mb' }));

  app.get('/status', function(request, response) {
    response.status(200).send('OK');
  });

  // This is actually a potential leak because it allows *any* logged in user to see the status of any task.
  // It's just the status though, and this whole thing needs to get redone at some point anyway, so I'm leaving it.
  app.get(
    '/v1/synctasks/:id',
    checkToken,
    function(request, response) {
      tasks.get(request.params.id, jsonp(response));
    }
  );

  app.get(
    '/v1/device/data/:id',
    checkToken,
    function(request, response) {
      tasks.get(request.params.id, function(err, task){
        if (err) {
          return response.status(500).send('Error getting sync task');
        }

        if (!task) {
          return response.status(404).send('No sync task found');
        }

        if (!task.filePath){
          log.warn('Task did not have a file', task);
          return response.status(404).send('No data file for sync task');
        }

        fs.readFile(task.filePath, function(err, data) {
          if (err) {
            log.error('Error reading file', task.filePath);
            return response.status(500).send('Error reading data file');
          }
          return response.status(200).send(data);
        });
      });
    }
  );

  /*
    send the actual ingested data to the platform
  */
  app.post(
    '/data/?:groupId?',
    checkToken,
    function(req, res) {
      var userid = req._tokendata.userid;

      var array = req.body;

      if (typeof(array) !== 'object') {
        return res.status(400).send(util.format('Expected an object body, got[%s]', typeof(array)));
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
            if (!req.params.groupId) {
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

                if (groupId === req.params.groupId && (perms.upload || perms.root)) {
                  return cb(null, groupId);
                }
              }

              cb({
                statusCode: 403,
                message: 'You don\'t have rights to upload to that account.'
              });
            });
          },
          function(groupId, cb) {
            lookupGroupId(groupId, cb);
          },
          // if there are records with source: 'carelink' in the dataset,
          // we need to delete old carelink data first
          function(groupId, cb) {
            dataBroker.maybeDeleteOldCarelinkData(groupId, array, function() {
              cb(null, groupId);
            });
          },
          function(groupId, cb) {
            async.mapSeries(
              array,
              function(obj, cb) {
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
              // err.message appears to not get serialized if it's an Error, so store it as err.reason
              err.reason = err.message;
              res.send(err.statusCode, err);
            } else {
              var groupMessage = req.params.groupId ? ('To group[' + req.params.groupId + ']') : '';
              log.warn(err, 'Problem uploading for user[%s]. %s', userid, groupMessage);
              res.send(500);
            }
          } else {
            res.status(200).send(duplicates);
          }
        }
      );
    }
  );

  return app;
}

module.exports = jellyfishService;
