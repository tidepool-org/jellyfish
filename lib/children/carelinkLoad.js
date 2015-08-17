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
var stream = require('stream');
var _ = require('lodash');

var amoeba = require('amoeba');
var async = require('async');
var except = amoeba.except;
var fetchFromCarelink = require('./fetch.js');
var pre = amoeba.pre;

var env = require('../../env.js');
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

var storage = require('../storage')(env).createDefault();

var input = '';
process.stdin.on('data', function (chunk) {
  input += chunk.toString();
  if (input.lastIndexOf('}') === input.length - 1) {
    var config = JSON.parse(input);

    input = null;

    process.nextTick(function () {
      go(config);
    });
  }
});

function go(config) {
  async.waterfall(
    [
      function (cb) {
        fetch(config.userId, config.privatePair, 'carelink.csv', config.carelink, cb);
      }
    ],
    function (err, updates) {
      if (!_.isEmpty(err)) {
        fail('Carelink download failed', err);
      }
      process.send({updates: updates});
      process.exit(0);
    }
  );
}

function fail(reason, error) {
  log.warn(error, 'Failing due to error, with reason: ', reason);
  if (!_.isEmpty(taskStorageDir)) {
    fs.writeFileSync(path.join(taskStorageDir, 'error.json'), JSON.stringify({ reason: reason, error: error }));
  }
  process.exit(255);
}

function fetch(userId, privatePair, filename, config, cb) {
  if (_.isEmpty(config)) {
    process.nextTick(cb);
  } else {
    var type = config.type;

    log.info('Fetching %s data', type);

    var startTime = new Date().valueOf();

    fetchFromCarelink(config, function (err, dataStream) {
      if (!_.isEmpty(err)) {
        if(err.code && err.message) {
          fail(err.message, err);
          return;
        }
        fail('Couldn\'t fetch!?', err);
        return;
      }

      var updates = {};

      var bytesPulled = 0;
      var recordData = '';
      var recordRegex = /DEVICE DATA \((\d+?) records\)/i;
      var recordCount = 0;

      dataStream.on('data', function(chunk) {
        if (bytesPulled === 0) {
          log.info('First byte pulled from %s in %sms', type, new Date().valueOf() - startTime);
        }
        bytesPulled += chunk.length;

        // Look for record count
        if (recordData != null) {
          recordData += chunk.toString();
          var match = recordRegex.exec(recordData);
          if (match && match.length) {
            recordCount = parseInt(match[1]);
            recordData = null;
          }
        }
      });
      dataStream.on('end', function() {
        log.info('All %s bytes pulled from %s in %sms', bytesPulled, type, new Date().valueOf() - startTime);

        // If no records, then error (backwards compatible)
        if (recordCount === 0) {
          updates.status = 'error';
          updates.reason = 'No records were found for the given time period';
          updates.error = {
            error: 'norecords',
            message: 'No records were found for the given time period',
            code: 204
          };
        }
      });

      storage.save(userId, privatePair, filename, dataStream, updates, cb);
    });
  }
}
