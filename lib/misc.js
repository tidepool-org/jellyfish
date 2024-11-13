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

var userIdsConfig = function (env, serverSecret) {
  const key = crypto.createHash('sha256').update(serverSecret).digest();

  return {
    encryptedFilePath: `${__dirname}/platform_users/${env}.json.enc`,
    unencryptedFilePath: `${__dirname}/platform_users/${env}.json`,
    ivBlockSize: 16,
    key: key,
    algorithm: 'aes-256-cbc',
  };
};

// Function to encrypt the contents of a JSON file
exports.encryptUserIds = function (env, serverSecret) {
  const config = userIdsConfig(env, serverSecret);

  if (!fs.existsSync(config.unencryptedFilePath)) {
    throw new Error(`Missing required file ${config.unencryptedFilePath}`);
  }

  const data = fs.readFileSync(config.unencryptedFilePath, 'utf8');
  const jsonArray = JSON.parse(data);
  const dataString = JSON.stringify(jsonArray);
  const iv = crypto.randomBytes(config.ivBlockSize);

  const cipher = crypto.createCipheriv(config.algorithm, config.key, iv);
  let encrypted = cipher.update(dataString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const ivHex = iv.toString('hex');
  const encryptedWithIV = ivHex + encrypted;
  fs.writeFileSync(config.encryptedFilePath, encryptedWithIV);
  console.log(`File encrypted and saved as ${config.encryptedFilePath}`);
};

// Function to decrypt an encrypted file and return the original array of IDs
exports.decryptUserIds = function (env, serverSecret) {
  const config = userIdsConfig(env, serverSecret);

  if (!fs.existsSync(config.encryptedFilePath)) {
    throw new Error(`Missing required file ${config.encryptedFilePath}`);
  }

  const encryptedWithIV = fs.readFileSync(config.encryptedFilePath, 'utf8');
  const ivHex = encryptedWithIV.slice(0, 32);
  const encryptedData = encryptedWithIV.slice(32);
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(config.algorithm, config.key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
};
