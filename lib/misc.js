/*
 * == BSD2 LICENSE ==
 */

'use strict';

var crypto = require('crypto');

var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

exports.generateId = function(fields) {
  var hasher = crypto.createHash('sha1');

  for (var i = 0; i < fields.length; ++i) {
    var val = fields[i];
    if (val == null) {
      throw except.IAE('null value in fields[%s]', fields);
    }
    hasher.update(String(val));
    hasher.update('_');
  }

  return base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
};

