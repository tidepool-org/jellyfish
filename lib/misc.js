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

var crypto = require('crypto');

var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

var schema = require('./schema/schema');

/**
 * Generates an id by
 *
 * 1. concatenating the provided fields together
 * 2. hashing the concatenation
 * 3. base32 encoding the result with a hyphen as the padding character
 *
 * This algorithm uses the hyphen as the padding character in order to generate URL-safe ids.
 *
 * Also, when we concatenate the values together, we inject a delimiter (underscore) in order
 * to protect from unforeseen collisions.  For example, if provided with the following two arrays
 *
 * ["bob", "omaley"]
 * ["bobo", "maley"]
 *
 * Just a straight concatenation would result in "bobomaley" and ultimately the same id.  By
 * adding a delimiter, we actually produce two different concatenations ("bob_omaley" and "bobo_maley")
 * which will result in different ids.
 *
 * @param fields an array of values to be concatenated together into a unique string
 * @returns {string} the base32 encoded hash of the delimited-concatenation of the provided fields (also known as a "unique" id)
 */
function generateId(fields) {
  var hasher = crypto.createHash('sha1');

  for (var i = 0; i < fields.length; ++i) {
    var val = fields[i];
    if (val == null) {
      throw except.IAE('null value in fields[%s]', fields);
    }
    hasher.update(String(val));
    hasher.update('_');
  }
  // adding an additional string to the hash data for BtUTC
  // to ensure different IDs generated when uploading data
  // that has been uploaded before
  hasher.update(String('bootstrap'));
  hasher.update('_');

  return base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
};

function generateInternalId(externalId, groupId) {
  return generateId([externalId, groupId]);
}

function ensureInternalId(datum) {
  if (datum._id == null) {
    datum._id = generateInternalId(datum.id, datum._groupId);
  }
  return datum;
}

function generateExternalId(datum) {
  return schema.generateId(datum, schema.idFields(datum.type));
}


exports.generateId = generateId;
exports.generateInternalId = generateInternalId;
exports.ensureInternalId = ensureInternalId;
exports.generateExternalId = generateExternalId;
