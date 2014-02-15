/*
 == BSD LICENSE ==
 Copyright (C) 2014 Tidepool Project
 
 This program is free software; you can redistribute it and/or modify it under
 the terms of the associated License, which is identical to the BSD 2-Clause
 License as published by the Open Source Initiative at opensource.org.
 
 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 FOR A PARTICULAR PURPOSE. See the License for more details.
 
 You should have received a copy of the License along with this program; if
 not, you can obtain one at http://tidepool.org/licenses/
 == BSD LICENSE ==
*/

/* Sync device data (Diasend, Medtronic, Dexcom) for user

 Usage:

 - From a node app with `child_process.fork('./scripts/sync', ['<JSON payload>'])`
 - From the command line with `$ node lib/children/sync.js <JSON payload>`

 payload = {
   userId: '',
   groupId: '',
   timezoneOffset: '',
   diasendUsername: '',
   diasendPassword: '',
   carelinkUsername: '',
   carelinkPassword: '',
   dexcomFile: ''
 }
*/

var fs = require('fs');

var _ = require('lodash');
var diasend = require('anim-parser');
var dxcomParser = require('dxcom-parser');
var es = require('event-stream');
var mmcsv = require('mmcsv-carelink-data');
var mongojs = require('mongojs');
var moment = require('moment');

var config = require('../../env.js');
var log = require('../log.js')('sync.js');

(function(){
// Connect to MongoDB
  var db = mongojs(config.mongoConnectionString, ['deviceData', 'groups','syncTasks']);


  function upload(db, credentials, options, callback) {

    // anim-parser needs a local directory to download its xls files
    // so it can use the 'xlhtml' binary on them
    var baseDir = './files';
    if (! fs.existsSync(baseDir)) {
      log.info('Creating file for storage of uploaded docs[%s]', baseDir);
      fs.mkdirSync(baseDir);
    }

    function fetch(credentials, options, callback) {
      function handleReadings(err, readings) {
        if (err != null) {
          return callback(err);
        }

        readings = readings.map(function(reading) {
          reading.groupId = options.groupId;
          reading.company = options.company;

          return reading;
        });

        log.info('fetched %s records, count %s', options.company, readings.length);

        db.deviceData.insert(readings, function(err){
          if (err != null) {
            return callback(err);
          }

          log.info('inserted %s records in db, count %s', options.company, readings.length);
          handleDexcom(options, callback);
        });
      };

      log.info('Using options[%j]', options);
      options.fetcher.fetch(
        credentials.username,
        credentials.password,
        options.timezoneOffset,
        options.daysAgo || 100,
        handleReadings
      );
    }

    function handleDexcom(options, cb) {
      var count = 0;
      var file = options.dexcomFile;

      if (!file) {
        log.info('no dexcom file to read');
        return cb(null);
      }

      log.info('Parsing Dexcom file[%s]', file);
      var dexcomDataIn = fs.createReadStream(file);
      var sugars = dxcomParser.sugars(options.timezoneOffset);
      sugars = sugars.on('data', function (raw) {
        var entry = JSON.parse(raw);

        if (entry && entry.time && entry.time.indexOf('NaN') == -1) {
          count++;

          entry.groupId = options.groupId;
          entry.company = 'dexcom';

          db.deviceData.save(entry, function () {});
        }
      });
      sugars = sugars.on('end', function () {
        log.info('Done parsing Dexcom, [%s] data points emitted.', count);
        fs.unlinkSync(file);
      });

      es.pipeline(dexcomDataIn, sugars);
    }

    db.deviceData.remove({groupId: options.groupId}, function() {
      fetch(credentials, options, callback);
    });
  }

// Main function
  function run() {
    var payload = parsePayload();
    log.info('using process.argv[%j]', payload);

    if (!payload) {
      log.error('ERROR: Could not get JSON payload argument');
      return process.exit(1);
    }

    var start = moment.utc();
    var finish;
    log.info('Starting sync');

    var taskId = payload.syncTaskId;
    var task = {_id: taskId};
    if (taskId) {
      task.userId = payload.userId;
      task.data = getTaskData(payload);
      task.status = 'pending';
      task.start = start.format();
      updateSyncTask(task, startSync);
    }
    else {
      startSync();
    }

    function startSync(err) {
      var credentials = getCredentials(payload);
      var options = getUploadOptions(payload);

      if (!credentials) {
        return onSyncError('No device credentials provided');
      }
      log.info('Fetching [%s] data for user [%s]', options.company, credentials.username);
      upload(db, credentials, options, onSyncFinish);
    }

    function onSyncFinish(err) {
      if (err) {
        onSyncError(err);
      }
      else {
        onSyncSuccess();
      }
    }

    function onSyncSuccess() {
      if (taskId) {
        finish = moment.utc();
        task.finish = finish.format();
        task.duration = finish.diff(start);
        task.status = 'success';
        updateSyncTask(task, done);
      }
      else {
        done();
      }
    }

    function onSyncError(err) {
      log.warn(err, 'Sync error!?');
      if (taskId) {
        finish = moment.utc();
        task.finish = finish.format();
        task.duration = finish.diff(start);
        task.status = 'error';
        task.error = {message: err.toString()};
        updateSyncTask(task, done);
      }
      else {
        done();
      }
    }

    function done() {
      log.info('Finished sync');
      // This seems necessary when used as a `child_process.spawn()`
      // although couldn't find it in documentation
      // Closest thing (but seems to be old version of node):
      // https://github.com/joyent/node/issues/2605#issuecomment-3687603
      process.exit();
    }
  }

// Retrieve payload from arguments
  function parsePayload() {
    var payload = process.argv[2];
    if (!payload) {
      return null;
    }

    try {
      payload = JSON.parse(payload);
    }
    catch (e) {
      log.error('[sync.js] ERROR: Payload argument must be valid JSON');
      payload = null;
    }

    return payload;
  }

// Extract from payload what to save in database under `syncTask.data`
  function getTaskData(payload) {
    return _.omit(payload, [
      'syncTaskId', 'userId', 'diasendPassword', 'carelinkPassword'
    ]);
  }

// Update sync task object in database
  function updateSyncTask(task, callback) {
    db.syncTasks.save(task, callback);
  }

// Extract device credentials from payload
  function getCredentials(payload) {
    var credentials;

    if (payload.diasendUsername) {
      credentials = {
        username: payload.diasendUsername,
        password: payload.diasendPassword
      };
    }
    else if (payload.carelinkUsername) {
      credentials = {
        username: payload.carelinkUsername,
        password: payload.carelinkPassword
      };
    }

    return credentials;
  }

// Build upload options from payload
  function getUploadOptions(payload) {
    var options = payload;

    if (payload.diasendUsername) {
      options.company = 'animas';
      options.fetcher = diasend;
    }
    else if (payload.carelinkUsername) {
      options.company = 'medtronic';
      options.fetcher = mmcsv;
    }

    return options;
  }

  run();
})();
