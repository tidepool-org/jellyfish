/*
 * == BSD2 LICENSE ==
 */

'use strict';

var async = require('async');
var util = require('util');

var amoeba = require('amoeba');
var except = amoeba.except;

var schemaBuilder = require('./schema');


module.exports = function(streamDAO) {
  var schemas = schemaBuilder(streamDAO);
  var knownTypes = Object.keys(schemas);

  return {
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