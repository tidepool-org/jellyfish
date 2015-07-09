/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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
var path = require('path');

var amoeba = require('amoeba');
var files = amoeba.files;
var moment = require('moment');
var pre = amoeba.pre;
var except = amoeba.except;

var log = require('../log.js')('storage/local.js');

module.exports = function(storage, storageConfig) {
  pre.notNull(storage);
  pre.notNull(storageConfig);
  var type = pre.hasProperty(storageConfig, 'type');
  var encryption = pre.hasProperty(storageConfig, 'encryption');
  var directory = pre.hasProperty(storageConfig, 'directory');

  if (type != 'local') {
    throw except.IAE("Storage type must be 'local'");
  }

  files.mkdirsSync(directory);

  return {
    type: function() {
      return type;
    },

    get: function(fileConfig, privatePair, cb) {
      pre.notNull(fileConfig);
      pre.notNull(cb);

      var filePath = fileConfig.path;
      if (fileConfig.encryption != 'none') {
        filePath = storage.decrypt(new Buffer(filePath, 'hex'), 'aes256', privatePair);
      }

      fs.open(filePath, 'r', function(err, fd) {
        if (err) {
          return cb(err, null);
        }

        var dataStream = fs.createReadStream(null, {fd: fd, encoding: 'binary'});

        if (fileConfig.encryption != 'none') {
          log.info('Applying %s decryption after reading', fileConfig.encryption);
          dataStream = dataStream.pipe(crypto.createDecipher(fileConfig.encryption, storage.calculateEncryptionKey(privatePair)));
        }

        return cb(null, dataStream);
      });
    },

    save: function(userId, privatePair, fileName, dataStream, updates, cb) {
      pre.notNull(userId);
      pre.notNull(privatePair);
      pre.notNull(fileName);
      pre.notNull(dataStream);
      pre.notNull(updates);
      pre.notNull(cb);

      var baseDirectory = path.resolve(path.join(directory, privatePair.id, moment.utc().format()));
      files.mkdirsSync(baseDirectory);

      if (encryption != 'none') {
        log.info('Applying %s encryption before writing', encryption);
        dataStream = dataStream.pipe(crypto.createCipher(encryption, storage.calculateEncryptionKey(privatePair)));
      }

      var filePath = path.join(baseDirectory, fileName);

      log.info('Writing data to file [%s]', filePath);

      var out = fs.createWriteStream(filePath, {encoding: 'binary'});
      out.on('error', function(err) {
        log.error(err, 'Failed to write data to file [%s]', filePath);
        cb('Failed to write data to file', null);
      });
      out.on('finish', function() {
        log.info('Done writing data to file [%s]', filePath);

        if (encryption != 'none') {
          filePath = storage.encrypt(filePath, 'aes256', privatePair).toString('hex');
        }

        updates._userId = userId;
        updates._storage = {type: type, encryption: encryption, path: filePath};

        cb(null, updates);
      });

      dataStream.pipe(out);
      dataStream.resume();
    }
  };
};
