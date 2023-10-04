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

var ObjectID = require('mongodb').ObjectID;
var _ = require('lodash');

module.exports = function(mongoClient) {
  function syncTasks(clientCb, collCb) {
    mongoClient.withCollection('syncTasks', clientCb, collCb);
  }

  return {
    create: function(cb) {
      syncTasks(cb, function(collection, callback){
        // Mongo doesn't give you the document you created back on insert, so we either have
        // to look it up again, or generate the ID here.  We choose the latter.
        var id = new ObjectID().toString();
        var time = new Date().toISOString();
        collection.insertOne({_id: id, _createdTime: time, _modifiedTime: time, status: 'created'}, function(err, result){
          callback(err, result[0]);
        });
      });
    },
    get: function(id, cb) {
      syncTasks(cb, function(collection, callback){
        collection.findOne({_id: id}, callback);
      });
    },
    update: function(taskId, updates, cb) {
      updates = _.omit(updates, ['_id']);
      updates._modifiedTime = new Date().toISOString();
      syncTasks(cb, function(collection, callback){
        collection.updateOne({_id: taskId}, updates, function(err, results){
          callback(err, results);
        });
      });
    },
    deleteAll: function(cb) {
      syncTasks(cb, function(collection, callback){
        collection.deleteMany(callback);
      });
    },
    list: function(userIds, cb) {
      if (!Array.isArray(userIds)) {
        userIds = [userIds];
      }
      syncTasks(cb, function(collection, callback) {
        collection.find({_userId: {$in: userIds}}).toArray(callback);
      });
    },
    sanitize: function(task) {
      if (task) {
        if (task._id != null) {
          task = _.clone(task);
          task.id = task._id;
        }
        task = _.pick(task, ['id', 'status', 'reason', 'error']);
      }
      return task;
    }
  };
};
