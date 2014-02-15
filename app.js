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

var fs = require('fs');

var async = require('async');
var express = require('express');
var path = require('path');

var config = require('./env.js');
var log = require('./lib/log.js')('app.js');
var uploads = require('./lib/uploads.js')(config);
var urlize = require('nurlize');

var jsonp = function(response) {
    return function(error, data) {
      if(error) {
        log.log(error, 'an error occurred!?');
        response.jsonp(500, {error: error});
        return;
      }
      if (data && data.url) {
        data.url = response.urlize(data.url);
      }
      response.jsonp(data);
    }
  };

(function(){
  var hakken = require('hakken')(config.discovery).client();

  var userApiWatch = hakken.randomWatch(config.userApi.serviceName);

  var seagullWatch = hakken.randomWatch(config.seagull.serviceName);
  hakken.start(function ( ) {
    userApiWatch.start(function ( ) { });
    seagullWatch.start(function ( ) { });
  });

  var userApiClientLibrary = require('user-api-client');
  var userApiClient = userApiClientLibrary.client(config.userApi, userApiWatch);
  var seagullClient = require('tidepool-seagull-client')(seagullWatch);

  var middleware = userApiClientLibrary.middleware;
  var checkToken = middleware.expressify(middleware.checkToken(userApiClient));

  var uploadDir = './uploads';
  if (! fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  var app = express();

  app.use(express.compress());
  app.use(function(req, res, next){
    var scheme = urlize.valid(app.urlize( )).shift( );
    var url = app.urlize(scheme, req.headers.host, req.url).urlize('.').urlize;
    req.urlize = url;
    res.urlize = url('/').urlize;
    req.tidepool = {};
    next();
  });

  app.get('/status', function(request, response) {
    response.send(200, 'OK');
  });

  app.post(
    '/uploads',
    checkToken,
    function(req, res) {
      userMetadataClient.getMeta(req.tidepool.user.userhash, function(err, userMeta){
        var payload = req.sandcastle = app.sandcastle.payload(req);
        payload.start(userMeta, uploads, jsonp(res));
      });
    }
  );

  // app.use(express.bodyParser({ keepExtensions: true, uploadDir: uploadDir }));
  app.post(
    '/v1/device/upload',
    checkToken,
    function(req, res) {
      log.info('start upload authorization');
      async.waterfall(
        [
          function(cb) {
            log.info('with token');
            userApiClient.withServerToken(cb);
          },
          function(token, cb) {
            log.info('get private pair');
            seagullClient.getPrivatePair(req._tokendata.userid, 'uploads', token, cb);
          }
        ],
        function(err, hashPair) {
          if (err != null) {
            if (err.statusCode === undefined) {
              log.warn(err, 'Failed to get private pair for user[%s]', req._tokendata.userid);
              res.send(500);
            }
            else {
              res.send(err.statusCode, err.message);
            }
            return;
          }

          if (hashPair == null) {
            log.warn('Unable to get hashPair, something is broken...');
            res.send(503);
            return;
          }

          if (app.sandcastle) {
            var payload = req.sandcastle = app.sandcastle.payload(req);
            var meta = { groupId: hashPair.id };
            payload.start(meta, uploads, jsonp(res));
          } else {
            jsonp(res)("no sandcastle", {msg: 'not ready'});
          }
          // var payload = req.body || {};
          // payload.groupId = hashPair.id;
          // payload.dexcomFile = req.files['dexcom'].path;

          // uploads.upload(payload, jsonp(res));
        }
      );
    }
  );

  // This is actually a potential leak because it allows *any* logged in user to see the status of any task.
  // It's just the status though, and this whole thing needs to get redone at some point anyway, so I'm leaving it.
  app.get(
    '/v1/synctasks/:id',
    checkToken,
    function(request, response) {
      uploads.syncTask(request.params.id, jsonp(response));
    }
  );

  app.post('/v1/clientlogs', function(request, response) {
    var message = request.body;
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    log.log('CLIENTLOGS:', message);
    response.send(201);
  });

  app.use(express.static(path.join(__dirname, './static')));

  process.on('uncaughtException', function(err){
    log.error(err, 'Uncaught exception bubbled all the way up!');
  });

  if (config.httpPort != null) {
    require('http').createServer(app).listen(config.httpPort, function(){
      log.info("Api server running on port[%s]", config.httpPort);
      app.urlize = urlize('http://').urlize;
    });
  }

  if (config.httpsPort != null) {
    require('https').createServer(config.httpsConfig, app).listen(config.httpsPort, function(){
      log.info("Api server listening for HTTPS on port[%s]", config.httpsPort);
      app.urlize = urlize('https://').urlize;
    });
  }

  if (config.discovery != null) {
    var serviceDescriptor = { service: config.serviceName };
    if (config.httpsPort != null) {
      serviceDescriptor['host'] = config.publishHost + ':' + config.httpsPort;
    }
    else if (config.httpPort != null) {
      serviceDescriptor['host'] = config.publishHost + ':' + config.httpPort;
      serviceDescriptor['protocol'] = 'http';
    }

    var hakken = require('hakken')(config.discovery).client( );
    hakken.start(function ( ) {
      console.log('hakken started', arguments);
      app.hakken = hakken;
      hakken.publish(serviceDescriptor);
      var createSandcastle = require('./lib/sandcastle');
      app.sandcastle = createSandcastle(config, app);
    });
  }
})();