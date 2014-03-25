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

var mongodb = require('mongodb');
var pre = require('amoeba').pre;

var log = require('../log.js')('mongoClient.js');

module.exports = function(config){
  pre.hasProperty(config, 'connectionString');

  var mongoClient = null;

  return {
    withCollection: function(collection, errorCb, happyCb) {
      if (mongoClient == null) {
        return errorCb(new Error('Must start the mongoClient before using it.'));
      }

      if (happyCb == null) {
        happyCb = function(coll) {
          return errorCb(null, coll);
        };
      }
      mongoClient.collection(collection, function(err, collection) {
        if (err != null) {
          errorCb(err);
        }
        happyCb(collection);
      });
    },
    start: function(cb){
      if (mongoClient != null) {
        return;
      }

      if (cb == null) {
        cb = function(err) {
          if (err != null) {
            log.warn(err, 'Error connection to mongo!');
            return;
          }
          log.info('Successfully connected to mongo');
        }
      }

      mongodb.MongoClient.connect(config.connectionString, function(err, db){
        if (db != null) {
          if (mongoClient != null) {
            db.close();
            return;
          }
          mongoClient = db;
        }

        cb(err);
      });
    },
    close: function() {
      if (mongoClient != null) {
        mongoClient.close();
        mongoClient = null;
      }
    }
  }
};