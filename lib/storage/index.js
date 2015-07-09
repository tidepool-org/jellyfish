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

var aws = require('aws-sdk');

var amoeba = require('amoeba');
var except = amoeba.except;
var pre = amoeba.pre;

var log = require('../log.js')('storage/index.js');

module.exports = function(env) {
  pre.notNull(env);
  pre.hasProperty(env, 'storage');
  pre.hasProperty(env.storage, 'types');
  pre.hasProperty(env.storage, 'default');
  pre.hasProperty(env, 'saltDeploy');

  return {
    create: function(storageConfig) {
      pre.notNull(storageConfig);
      pre.hasProperty(storageConfig, 'type');

      switch (storageConfig.type) {
        case 'local':
          return require('./local.js')(this, storageConfig);
        case 'aws/s3':
          return require('./aws/s3.js')(aws, env, this, storageConfig);
        default:
          throw except.IAE("Unknown storage type [%s], only known types are 'local' and 'aws/s3'", storageConfig.type);
      }
    },

    createType: function(storageType) {
      pre.notNull(storageType);

      return this.create(env.storage.types[storageType]);
    },

    createDefault: function() {
      return this.createType(env.storage.default);
    },

    calculateEncryptionKey: function(privatePair) {
      pre.notNull(privatePair);

      var hash = crypto.createHash('SHA256');
      hash.update(privatePair.hash);
      hash.update(env.saltDeploy);
      var encryptionKey = hash.digest('hex').toString();
      return encryptionKey;
    },

    encrypt: function(value, encryption, privatePair) {
      pre.notNull(value);
      pre.notNull(encryption);
      pre.notNull(privatePair);

      var cipher = crypto.createCipher(encryption, this.calculateEncryptionKey(privatePair));
      cipher.write(value);
      cipher.end();
      return cipher.read();
    },

    decrypt: function(value, encryption, privatePair) {
      pre.notNull(value);
      pre.notNull(encryption);
      pre.notNull(privatePair);

      var decipher = crypto.createDecipher(encryption, this.calculateEncryptionKey(privatePair));
      decipher.write(value);
      decipher.end();
      return decipher.read().toString();
    }
  };
};
