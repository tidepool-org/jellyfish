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

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var amoeba = require('amoeba');
var async = require('async');
var Busboy = require('busboy');
var files = amoeba.files;
var pre = amoeba.pre;

var log = require('./log.js')('uploadFlow.js');

module.exports = function (config, tasks) {
  var storageDir = pre.hasProperty(config, 'storageDir');
  log.info('Storing temporary files in[%s]', storageDir);
  files.mkdirsSync(storageDir);

  function parseForm(req, taskDir, cb) {
    // configure a stream based on busboy
    var busboy = new Busboy({headers: req.headers});

    var retVal = {};

    busboy.on('file', function (name, file, filename, encoding, mimetype) {
      if (name === 'dexcom') {
        var dexcomFile = path.join(taskDir, 'dexcom.csv');
        var out = fs.createWriteStream(dexcomFile);
        var bytesWritten = 0;
        file.on('data', function (chunk) {
          bytesWritten += chunk.length;
          out.write(chunk);
        });
        file.on('end', function () {
          log.info('Loaded dexcom data, [%s] bytes', bytesWritten);
          out.end();
          if (bytesWritten > 0) {
            retVal.dexcom = {
              type: 'dexcom',
              file: dexcomFile,
              encoding: encoding,
              name: filename,
              mimetype: mimetype
            }
          }
        });
        file.resume();
      } else {
        // resume() the ignored streams, otherwise busboy won't fire the 'finish' event.
        file.resume();
      }
    });

    busboy.on('field', function (name, value) {
      retVal[name] = value;
    });

    busboy.on('end', function (err, results) {
      cb(err, retVal);
    });

    req.pipe(busboy);
  }


  function buildConfig(meta, formParams) {
    var retVal = _.assign({}, meta);

    if ( !(formParams.carelinkUsername == null || formParams.carelinkUsername === '') ) {
      retVal.carelink = {
        type: 'carelink',
        username: formParams.carelinkUsername,
        password: formParams.carelinkPassword,
        timezone: formParams.carelinkTimezone,
        daysAgo: formParams.daysAgo
      };
    }

    if ( !(formParams.diasendUsername == null || formParams.diasendUsername === '') ) {
      retVal.diasend = {
        type: 'diasend',
        username: formParams.diasendUsername,
        password: formParams.diasendPassword,
        timezone: formParams.diasendTimezone,
        daysAgo: formParams.daysAgo
      };
    }

    if ( !(formParams.tconnectUsername == null || formParams.tconnectUsername === '') ) {
      retVal.tconnect = {
        type: 'tconnect',
        username: formParams.tconnectUsername,
        password: formParams.tconnectPassword,
        daysAgo: formParams.daysAgo
      };
    }

    if (formParams.dexcom != null) {
      retVal.dexcom = _.assign(_.omit(formParams.dexcom, 'dexcomTimezone'), {timezone: formParams.dexcomTimezone});
    }

    retVal.dexcom = formParams.dexcom;
    return retVal;
  }

  return {
    ingest: function (req, meta, cb) {
      tasks.create(function (err, taskId) {
        // Create a task dir to store intermediate state specific to this task.
        var taskDir = path.join(storageDir, String(taskId));
        files.mkdirsSync(taskDir);

        parseForm(req, taskDir, function (err, formParams) {
          if (err != null) {
            return cb(err);
          }

          // Return quickly
          cb(null, {
            _id: taskId,
            syncTaskId: taskId,
            path: '/v1/synctasks/' + taskId,
            status: 'created'
          });

          // Actually do work
          tasks.update(taskId, { status: 'pending' }, function (error) {
            if (error != null) {
              log.error(error, 'Failure to update task[%j]', taskId);
            }

            var theChild = childProcess.spawn(
              'node',
              [path.join(__dirname, '/children/load.js'), taskDir],
              { stdio: ['pipe', process.stdout, process.stderr] }
            );
            theChild.on('exit',
                  function(code) {
                    var updates = {};

                    if (code === 0) {
                      updates.status = 'success';
                    } else {
                      log.info('Load failed with status[%s]', code);

                      var errorFile = path.join(taskDir, 'error.json');
                      if (fs.existsSync(errorFile)) {
                        _.assign(updates, JSON.parse(fs.readFileSync(errorFile)));
                      }

                      updates.status = 'error';
                    }

                    // Make sure we do not change the id
                    updates = _.omit(updates, '_id');

                    tasks.update(taskId, updates, function(err){
                      if (err != null) {
                        log.warn(err, 'Error updating task[%s]', taskId);
                      }
                      log.info('Task[%s] status[%j], removing dir[%s]', taskId, updates, taskDir);
                      files.rmdirsSync(taskDir);
                    });
                  });
            theChild.stdin.write(JSON.stringify(buildConfig(meta, formParams)));
          });
        });
      });
    }
  };
};
