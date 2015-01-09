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
var path = require('path');
var util = require('util');
var _ = require('lodash');

var amoeba = require('amoeba');
var except = amoeba.except;
var lifecycle = amoeba.lifecycle();
var httpClient = amoeba.httpClient();

var config = require('./env.js');
var log = require('./lib/log.js')('app.js');
var misc = require('./lib/misc.js');

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

(function(){
  var hakken = require('hakken')(config.discovery, log).client();
  lifecycle.add('hakken', hakken);

  var userApiWatch = hakken.watchFromConfig(config.userApi.serviceSpec);
  var seagullWatch = hakken.watchFromConfig(config.seagull.serviceSpec);
  hakken.start();
  userApiWatch.start();
  seagullWatch.start();

  var userApiClientLibrary = require('user-api-client');
  var userApiClient = userApiClientLibrary.client(config.userApi, userApiWatch);
  var seagullClient = require('tidepool-seagull-client')(seagullWatch);
  var gatekeeperClient = require('tidepool-gatekeeper').client(
    httpClient,
    userApiClient.withServerToken.bind(userApiClient),
    lifecycle.add('gatekeeper-watch', hakken.watchFromConfig(config.gatekeeper.serviceSpec))
  );

  var middleware = userApiClientLibrary.middleware;
  var checkToken = middleware.expressify(middleware.checkToken(userApiClient));

  var mongoClient = require('./lib/mongo/mongoClient.js')(config.mongo);
  mongoClient.start();

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

  app.use(express.compress());
  app.use(express.json({ limit: '4mb' }));

  app.get('/status', function(request, response) {
    response.send(200, 'OK');
  });

  /*
    used to process the carelink form data, now that is just for uploading and processing of the carelink csv
  */
  app.post(
    '/v1/device/upload/cl',
    checkToken,
    function(req, res) {
      lookupGroupId(req._tokendata.userid, function(err, groupId) {
        if (err != null) {
          if (err.statusCode == null) {
            log.warn(err, 'Failed to get private pair for user[%s]', req._tokendata.userid);
            res.send(500);
          } else {
            res.send(err.statusCode, err);
          }
          return;
        }

        if (groupId == null) {
          log.warn('Unable to get hashPair; something is broken...');
          res.send(503);
          return;
        }
        //get the form then
        carelinkUploadFlow.ingest(req, { groupId: groupId }, jsonp(res));
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
  );

  app.get(
    '/v1/device/data/:id',
    checkToken,
    function(request, response) {
      tasks.get(request.params.id, function(err, task){
        if (err) {
          return response.send(500, 'Error getting sync task');
        }

        if (!task) {
          return response.send(404, 'No sync task found');
        }

        if (!task.filePath){
          log.warn('Task did not have a file', task);
          return response.send(404, 'No data file for sync task');
        }

        fs.readFile(task.filePath, function(err, data) {
          if (err) {
            log.error('Error reading file', task.filePath);
            return response.send(500, 'Error reading data file');
          }
          return response.send(200, data);
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
        return res.send(400, util.format('Expected an object body, got[%s]', typeof(array)));
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
            res.send(200, duplicates);
          }
        }
      );
    }
  );

  process.on('uncaughtException', function(err){
    log.error(err, 'Uncaught exception bubbled all the way up!');
  });

  if (config.httpPort != null) {
    require('http').createServer(app).listen(config.httpPort, function(){
      log.info("Api server running on port[%s]", config.httpPort);
    });
  }

  if (config.httpsPort != null) {
    require('https').createServer(config.httpsConfig, app).listen(config.httpsPort, function(){
      log.info("Api server listening for HTTPS on port[%s]", config.httpsPort);
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

    hakken.publish(serviceDescriptor);
  }
})();
