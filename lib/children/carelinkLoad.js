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
var path = require('path');
var _ = require('lodash');

var amoeba = require('amoeba');
var async = require('async');
var except = amoeba.except;
var ingestion = require('in-d-gestion');
var pre = amoeba.pre;

var config = require('../../env.js');
var log = require('../log.js')('children/carelinkLoad.js');


// First command-line argument is an optional "storage location".  If this is set,
// then the script will write various programmatically readable things about how the
// task went, like if there is an error, it will dump an error object, etc.
var taskStorageDir = null;
if (process.argv.length >= 3) {
  taskStorageDir = process.argv[2];
  if (!fs.existsSync(taskStorageDir)) {
    throw except.ISE('taskStorageDir[%s] doesn\'t exist, please provide something that does', taskStorageDir);
  }
}

var storage = require('../storage')(config.storage);

var input = '';
process.stdin.on('data', function (chunk) {
  input += chunk.toString();
  if (input.lastIndexOf('}') === input.length - 1) {
    var config = JSON.parse(input);

    input = null;

    pre.hasProperty(config, 'groupId', 'groupId is a required property');

    process.nextTick(function () {
      go(config);
    });
  }
});

function go(config) {
  async.waterfall(
    [
      function (cb) {
        download(config, cb);
      }
    ],
    function (err, files) {
      if (!_.isEmpty(err)) {
        fail('Just another error', err);
      }
      var readStream = fs.createReadStream(files.location);
      readStream.pipe(process.stdout);
      process.exit(0);
    }
  );
}

function fail(reason, error) {
  log.warn(error, 'Failing due to error, with reason[%s].', reason);
  if (!_.isEmpty(taskStorageDir)) {
    fs.writeFileSync(path.join(taskStorageDir, 'error.json'), JSON.stringify({ reason: reason }));
  }
  process.exit(255);
}

function fetch(groupId, filename, config, cb) {
  if (_.isEmpty(config)) {
    process.nextTick(cb);
  } else {
    var type = config.type;

    var antacid = ingestion[type];
    if (_.isEmpty(antacid)) {
      throw except.ISE('Unknown service[%s] to fetch from.', type);
    }

    log.info('Fetching %s data for user[%s]', type, config.username);
    var startTime = new Date().valueOf();
    var bytesPulled = 0;
    antacid.fetch(config, function (err, dataStream) {
      if (!_.isEmpty(err)) {
        fail('Couldn\'t fetch!?', err);
        return;
      }

      dataStream.on('data', function (chunk) {
        if (bytesPulled === 0) {
          log.info('First byte pulled in [%s] millis.', new Date().valueOf() - startTime);
        }
        bytesPulled += chunk.length;
      });
      dataStream.on('end', function () {
        log.info('%s data pulled in [%s] millis.  Size [%s]', type, new Date().valueOf() - startTime, bytesPulled);
      });

      storage.save(groupId, filename, dataStream, cb);
    });
  }
}

function download(config, callback) {
  fetch(config.groupId, 'carelink.csv', config.carelink, function (err, loc) {
    return callback(err, _.isEmpty(loc) ? loc : { source: 'carelink', location: loc, config: config.carelink });
  });
}