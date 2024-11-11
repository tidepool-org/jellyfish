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
var fs = require('fs');
var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

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
exports.generateId = function (fields) {
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

var userArrayFileConfig = function (env, serverSecret) {
  return {
    iv: `${env}-environment`.substring(0, 16),
    key: serverSecret.substring(0, 32),
    algorithm: 'aes-256-cbc',
  };
};

exports.encryptArrayToFile = function (dataArray, filePath, env, serverSecret) {
  var config = userArrayFileConfig(env, serverSecret);

  var encryptedArray = dataArray.map((item) => {
    var cipher = crypto.createCipheriv(config.algorithm, config.key, config.iv);
    let encrypted = cipher.update(item, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  });
  fs.writeFileSync(filePath, JSON.stringify(encryptedArray));
};

exports.decryptArrayFromFile = function (filePath, env, serverSecret) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file ${filePath}`);
  }
  var config = userArrayFileConfig(env, serverSecret);
  var encryptedArray = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  var decryptedArray = encryptedArray.map((item) => {
    var decipher = crypto.createDecipheriv(
      config.algorithm,
      config.key,
      config.iv
    );
    let decrypted = decipher.update(item, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  });

  return decryptedArray;
};
