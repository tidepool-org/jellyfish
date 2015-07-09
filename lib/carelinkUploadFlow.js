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

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var amoeba = require('amoeba');
var files = amoeba.files;
var pre = amoeba.pre;

var log = require('./log.js')('carelinkUploadFlow.js');

module.exports = function (config, tasks) {
  var tempStorage = pre.hasProperty(config, 'tempStorage');
  log.info('Storing temporary files in[%s]', tempStorage);
  files.mkdirsSync(tempStorage);

  function buildConfig(parameters, privatePair) {
    var result = {};

    result.userId = parameters.targetUserId;
    result.privatePair = privatePair;
    result.carelink = {
      type: 'carelink',
      username: parameters.carelinkUsername,
      password: parameters.carelinkPassword,
      timezone: parameters.carelinkTimezone,
      daysAgo: parameters.daysAgo
    };

    return result;
  }

  return {
    ingest: function (parameters, privatePair, cb) {
      tasks.create(function (err, task) {
        var taskId = task._id;

        // Create a task dir to store intermediate state specific to this task.
        var taskDir = path.join(tempStorage, String(taskId));
        files.mkdirsSync(taskDir);

        // Return quickly
        cb(null, tasks.sanitize(task));

        //Actually do work
        tasks.update(taskId, _.merge(task, {status: 'pending'}), function (error) {
          if (error != null) {
            log.error(error, 'Failure to update task [%j] with status pending', taskId);
          }

          var theChild = childProcess.spawn(
            'node',
            [path.join(__dirname, 'children/carelinkLoad.js'), taskDir],
            { stdio: ['pipe', process.stdout, process.stderr, 'ipc'] }
          );

          var updates = {};
          theChild.on('message',function(message) {
            updates = message.updates;
          });

          theChild.on('exit', function(code) {
            if (!updates.status) {
              if (code === 0) {
                updates.status = 'success';
              } else {
                log.info('Carelink load failed with status [%s]', code);
                var errorFile = path.join(taskDir, 'error.json');
                if (fs.existsSync(errorFile)) {
                  _.assign(updates, JSON.parse(fs.readFileSync(errorFile)));
                }
                updates.status = 'error';
              }
            }

            tasks.update(taskId, _.merge(task, updates), function(err) {
              if (err != null) {
                log.warn(err, 'Error updating task [%s]', taskId);
              }
              log.info('Task [%s] removing directory [%s]', taskId, taskDir);
              files.rmdirsSync(taskDir);
            });
          });
          theChild.stdin.write(JSON.stringify(buildConfig(parameters, privatePair)));
        });
      });
    }
  };
};
