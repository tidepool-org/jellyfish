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
var express = require('express');
var compression = require('compression');
var bodyparser = require('body-parser');
var Busboy = require('busboy');
var path = require('path');
var storage = require('./storage')(env);
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

  log.warn("Got app: ", app);

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
  var carelinkUploadFlow = require('./carelinkUploadFlow.js')({ tempStorage: serverConfig.tempStorage }, tasks);
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
    log.info('Handling status request');
    response.status(200).send('OK');
  });

  function parseParameters(request, cb) {
    var parameters = {};

    var busboy = new Busboy({headers: request.headers});
    busboy.on('file', function(name, file) {
      file.resume();
    });
    busboy.on('field', function(name, value) {
      parameters[name] = value;
    });
    busboy.on('finish', function(err) {
      cb(err, parameters);
    });

    request.pipe(busboy);
  }

  function getUserPermissionsForGroup(userId, groupId, cb) {
    gatekeeperClient.groupsForUser(userId, function(err, groups) {
      return (err != null) ? cb(err) : cb(null, groups[groupId] || {});
    });
  }

  // [DEPRECATED]
  function authorizeUserForTaskDEPRECATED(task, userId, cb) {
    if (!task.filePath) {
      return cb(null, task);
    }

    getPrivatePair(userId, function(err, privatePair) {
      if (err) {
        log.warn(err, 'Failed to get private pair for user [%s]', userId);
        return cb({statusCode: 500, message: 'Error getting user private data'});
      }

      // Round about way of determining whether user is authorized for deprecated tasks
      var match = /.*\/([^/]+)\/[^/]+\/[^/]+/.exec(task.filePath);
      if (!match) {
        log.warn('Path [%s] does not include private id', task.filePath);
        return cb({statusCode: 500, message: 'Path does not include private id'});
      }
      if (match[1] != privatePair.id) {
        log.warn('User [%s] does not have view permission', userId);
        return cb({statusCode: 403, message: 'You do not have rights to view this data'});
      }

      // Add fake storage config
      task._storage = {type: 'local', encryption: 'none', path: task.filePath};

      return cb(null, task, privatePair);
    });
  }

  function authorizeUserForTask(task, userId, cb) {
    var targetUserId = task._userId;
    getUserPermissionsForGroup(userId, targetUserId, function (err, permissions) {
      if (err) {
        log.warn(err, 'Failed to get permissions for user [%s] in group [%s]', userId, targetUserId);
        return cb({statusCode: 500, message: 'Error getting permissions'});
      }

      if (!(permissions.root || permissions.view)) {
        log.warn(err, 'User [%s] does not have view permission for group [%s]', userId, targetUserId);
        return cb({statusCode: 403, message: 'You do not have rights to view this data'});
      }

      getPrivatePair(targetUserId, function(err, privatePair) {
        if (err) {
          log.warn(err, 'Failed to get private pair for user [%s]', userId);
          return cb({statusCode: 500, message: 'Error getting user private data'});
        }
        return cb(null, task, privatePair);
      });
    });
  }

  function getTaskAndAuthorizeUserForTask(taskId, userId, cb) {
    tasks.get(taskId, function(err, task) {
      if (err) {
        log.warn(err, 'Failed to get sync task with id [%s]', taskId);
        return cb({statusCode: 500, message: 'Error getting sync task'});
      }
      if (!task) {
        return cb({statusCode:404, message: 'No sync task found'});
      }

      if (task._userId) {
        return authorizeUserForTask(task, userId, cb);
      } else {
        return authorizeUserForTaskDEPRECATED(task, userId, cb);    // [DEPRECATED]
      }
    });
  }

  /*
   * Deals with Carelink data fetching it and then storing the file
   */
  app.post(
    '/v1/device/upload/cl',
    checkToken,
    function(request, response) {
      parseParameters(request, function(err, parameters) {
        if (err) {
          log.warn(err, 'Failed to parse parameters');
          return response.status(500).send('Error parsing parameters');
        }

        var currentUserId = request._tokendata.userid;
        var targetUserId = parameters.targetUserId;

        getUserPermissionsForGroup(currentUserId, targetUserId, function (err, permissions) {
          if (err) {
            log.warn(err, 'Failed to get permissions for user [%s] in group [%s]', currentUserId, targetUserId);
            return response.status(500).send('Error getting permissions');
          }

          if (!(permissions.root || permissions.upload)) {
            log.warn('User [%s] does not have upload permission for group [%s]', currentUserId, targetUserId);
            return response.status(403).send('You do not have rights to upload this data');
          }

          getPrivatePair(targetUserId, function(err, privatePair) {
            if (err) {
              log.warn(err, 'Failed to get private pair for user [%s]', targetUserId);
              return response.status(err.statusCode || 500).send(err);
            }

            carelinkUploadFlow.ingest(parameters, privatePair, function(err, data) {
              jsonp(response)(err, tasks.sanitize(data));
            });
          });
        });
      });
    }
  );

  // This is actually a potential leak because it allows *any* logged in user to see the status of any task.
  // It's just the status though, and this whole thing needs to get redone at some point anyway, so I'm leaving it.
  app.get(
    '/v1/synctasks/:id',
    checkToken,
    function(request, response) {
      getTaskAndAuthorizeUserForTask(request.params.id, request._tokendata.userid, function(err, task, privatePair) {
        if (err) {
          return response.status(err.statusCode).send(err.message);
        }
        jsonp(response)(err, tasks.sanitize(task));
      });
    }
  );

  app.get(
    '/v1/device/data/:id',
    checkToken,
    function(request, response) {
      getTaskAndAuthorizeUserForTask(request.params.id, request._tokendata.userid, function(err, task, privatePair) {
        if (err) {
          return response.status(err.statusCode).send(err.message);
        }
        storage.createType(task._storage.type).get(task._storage, privatePair, function(err, dataStream) {
          if (err) {
            return response.status(500).send(err);
          }
          dataStream.pipe(response.status(200));
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
          function(userId, cb) {
            getPrivatePair(userId, function(err, privatePair) {
              cb(err, privatePair ? privatePair.id : null);
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
