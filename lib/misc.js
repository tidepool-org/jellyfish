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
}

function generateInternalId(externalId, groupId) {
  return generateId([externalId, groupId]);
}

function ensureInternalId(datum) {
  if (!datum.id) {
    datum.id = generateExternalId(datum);
  }
  if (!datum._id) {
    datum._id = generateInternalId(datum.id, datum._groupId);
  }
  return datum;
}

function generateExternalId(datum) {
  return schema.generateId(datum, schema.idFields(datum.type));
}

function sortTimeAsc(a, b) {
  const timeA = new Date(a.time);
  const timeB = new Date(b.time);
  if (timeA < timeB)
    return -1;
  if (timeA > timeB)
    return 1;
  return 0;
}

function removeDuplicates(existingData, inputData) {
  const latestData = {};
  for (const datum of existingData) {
    const externalId = generateExternalId(datum)
    const internalId = generateInternalId(externalId, datum._groupId);
    latestData[datum._id] = datum;
  }

  // Duplicate inserted data may exist in the inputData array. This occurs
  // when there is multiple datum with the same id / _id. This is not allowed
  // and in the serial code would return a { statusCode: 400,
  // errorCode: 'duplicate', message: 'received a duplicate event'} error to the callback.
  // Since there be multiple duplicates we instead return an array of duplicates.
  const finalArray = [];
  const duplicates = [];
  inputData = inputData.slice(0);
  inputData.sort(sortTimeAsc);
  for (const datum of inputData) {
    const externalId = generateExternalId(datum);
    const internalId = generateInternalId(externalId, datum._groupId);

    // The absence of datum.createdTime indicates an insert whereas the
    // presence of it indicates an update. Disallow multiple inserts.
    if (!datum.createdTime && latestData[internalId]) {
      duplicates.push(datum);
      continue;
    }
    latestData[internalId] = datum;
    finalArray.push(datum);
  }
  return {
    array: finalArray,
    duplicates: duplicates,
    latestData: latestData,
  };
}

exports.sortTimeAsc = sortTimeAsc;
exports.removeDuplicates = removeDuplicates;
exports.generateId = generateId;
exports.generateInternalId = generateInternalId;
exports.ensureInternalId = ensureInternalId;
exports.generateExternalId = generateExternalId;
