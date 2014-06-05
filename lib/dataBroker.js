/*
 * == BSD2 LICENSE ==
 */

'use strict';

var crypto = require('crypto');
var util = require('util');

var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
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

        toAdd.forEach(function(d){
          if (d._id == null) {
            var hasher = crypto.createHash('sha1');
            if (e._id == null) {
              hasher.update(e.id);
              hasher.update(e.groupId);
              e._id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
            }
          }

          streamDAO.addOrUpdate(d);
        });
      });
    }
  };
};