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

var _ = require('lodash');
var async = require('async');
var util = require('util');

var amoeba = require('amoeba');
var except = amoeba.except;

var schemaBuilder = require('./schema');


module.exports = function(streamDAO) {
  var schemas = schemaBuilder(streamDAO);
  var knownTypes = Object.keys(schemas);

  return {
    maybeDeleteOldCarelinkData: function(array, cb) {
      // I have an array of objects
      // search them to see if any of them have a value source: 'carelink'
      // if so, then we need to get rid of old carelink data
      function searchForCarelink() {
        var sources = _.where(array, {source: 'carelink'});
        if (!_.isEmpty(sources)) {
          streamDAO.deleteOldCarelinkData();
        }
      }
      searchForCarelink();
      return cb();
    },
    addDatum: function(datum, cb) {
      var handler = schemas[datum.type];
      if (handler == null) {
        return cb(
          { statusCode: 400, message: util.format('Unknown type[%s], known types[%s]', datum.type, knownTypes) }
        );
      }

      handler(datum, function(err, toAdd) {
        if (err != null) {
          return cb(err);
        }

        if (! Array.isArray(toAdd)) {
          toAdd = [toAdd];
        }

        async.mapSeries(
          toAdd,
          function(item, cb) {
            streamDAO.addOrUpdateDatum(item, cb);
          },
          function(err) {
            cb(err);
          }
        );
      });
    }
  };
};