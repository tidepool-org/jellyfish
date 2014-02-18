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

var mongojs = require('mongojs');
var childProcess = require('child_process');
var es = require('event-stream');
var log = require('./log.js')(__filename);
var path = require('path');

module.exports = function(config) {
  var db = mongojs(config.mongoConnectionString, ['groups', 'syncTasks']);
  var tasks = require('./tasks')(db);

  return {
    createTask: function(cb) {
      tasks.create(cb)
    },
    updateTask: function(task, cb) {
      tasks.update(task, cb);
    },
    ingest: function (task) {
      log.info("INGESTING?", task._id, task);
      childProcess.fork(path.join(__dirname, '/children/ingest.js'), [task._id]);
    },
    syncTask: function(id, callback) {
      tasks.get(id, reporter);
      function reporter (err, data) {
        var url = '/v1/synctasks/' + id;
        if (err || !data) {
          return callback(err, {status: 'not found', url: url});
        }
        callback(err, { status: (data.status || null), url: url });
      }
    }
  };
};
