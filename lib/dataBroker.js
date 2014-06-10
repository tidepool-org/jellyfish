/*
 * == BSD2 LICENSE ==
 */

'use strict';

var util = require('util');

var amoeba = require('amoeba');
var except = amoeba.except;

var schemas = require('./schema');
var knownTypes = Object.keys(schemas);


module.exports = function(streamDAO) {
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

        toAdd.forEach(streamDAO.addOrUpdate.bind(streamDAO));
      });
    }
  };
};