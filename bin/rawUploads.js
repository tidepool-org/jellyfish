/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

 /*
  * Before running this script you need to setup your environment as if you
  * were running Jellyfish.
  *
  * There are two ways to use this script:
  *
  * 1) To list all of the uploads for a given user (not the uploading user, but
  * the target user):
  *
  * node bin/rawUploads.js list <user-id>
  *
  * This will list all uploads for the specified user id. The first field will
  * be the upload id and the second field will be the timestamp when the upload
  * was initiated.
  *
  * 2) To download to stdout a particular upload by id:
  *
  * node bin/rawUploads.js download <upload-id>
  *
  * The unencrypted upload will be piped to stdout.
  */

'use strict';

var async = require('async');

var amoeba = require('amoeba');
var httpClient = amoeba.httpClient();
var lifecycle = amoeba.lifecycle();

var env = require('../env.js');
var log = require('../lib/log.js')('rawUploads.js');

var hakken = lifecycle.add('hakken', require('hakken')(env.discovery, log).client());
var userApiClient = require('user-api-client').client(
  env.userApi,
  lifecycle.add('user-api-watch', hakken.watchFromConfig(env.userApi.serviceSpec)),
  httpClient
);
var seagullClient = require('tidepool-seagull-client')(
  lifecycle.add('seagull-watch', hakken.watchFromConfig(env.seagull.serviceSpec)),
  {},
  httpClient
);

var mongoClient = require('../lib/mongo/mongoClient.js')(env.mongo);
var storage = require('../lib/storage')(env);
var tasks = require('../lib/tasks.js')(mongoClient);

function die(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}

function exit() {
  mongoClient.close();
  process.exit(0);
}

function processArguments(args) {
  lifecycle.start();
  mongoClient.start(function(err) {
    if (err != null) {
      die(err);
    }
    switch (args[0]) {
      case 'list':
        listUploads(args[1]);
        break;
      case 'download':
        downloadUpload(args[1]);
        break;
      default:
        die("Unknown command: " + args[0]);
    }
  });
}

function listUploads(user) {
  tasks.list(user, function(err, userTasks) {
    if (err != null) {
      die(err);
    }
    userTasks.forEach(function(userTask) {
      console.log(userTask._id + ' ' + userTask._createdTime);
    });
    exit();
  });
}

function downloadUpload(id) {
  var savedTask;
  var savedPrivatePair;

  async.waterfall(
    [
      function(cb) {
        tasks.get(id, cb);
      },
      function(task, cb) {
        savedTask = task;
        userApiClient.withServerToken(cb);
      },
      function(token, cb) {
        seagullClient.getPrivatePair(savedTask._userId, 'uploads', token, cb);
      },
      function(privatePair, cb) {
        savedPrivatePair = privatePair;
        storage.createType(savedTask._storage.type).get(savedTask._storage, savedPrivatePair, cb);
      },
    ],
    function(err, dataStream) {
      if (err != null) {
        die(err);
      }
      dataStream.on('end', function() {
        exit();
      });
      dataStream.pipe(process.stdout);
    }
  );
}

function main() {
  processArguments(process.argv.slice(2));
}

main();
