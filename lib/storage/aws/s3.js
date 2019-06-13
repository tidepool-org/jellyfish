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

var _ = require('lodash');
var crypto = require('crypto');
var path = require('path');
var stream = require('stream');

var moment = require('moment');

var amoeba = require('amoeba');
var except = amoeba.except;
var pre = amoeba.pre;

var log = require('../../log.js')('storage/aws/s3.js');

module.exports = function(aws, env, storage, storageConfig) {
  pre.notNull(aws);
  pre.notNull(env);
  var awsCredentials = pre.hasProperty(env, 'awsCredentials');
  pre.notNull(storage);
  pre.notNull(storageConfig);
  var type = pre.hasProperty(storageConfig, 'type');
  var encryption = pre.hasProperty(storageConfig, 'encryption');
  var region = pre.hasProperty(storageConfig, 'region');
  var bucket = pre.hasProperty(storageConfig, 'bucket');

  if (type != 'aws/s3') {
    throw except.IAE("Storage type must be 'aws/s3'");
  }

  return {
    type: function() {
      return type;
    },

    get: function(fileConfig, privatePair, cb) {
      pre.notNull(fileConfig);
      pre.notNull(cb);

      var key = fileConfig.key;
      if (fileConfig.encryption != 'none') {
        key = storage.decrypt(new Buffer.from(key, 'hex'), 'aes256', privatePair);
        if (!key) {
          return cb('Failed to decrypt storage configuration', null);
        }
      }

      new aws.S3(_.merge(awsCredentials, {
        region: fileConfig.region,
        sslEnabled: true
      })).getObject({
        Bucket: fileConfig.bucket,
        Key: key,
        SSECustomerAlgorithm: 'AES256',
        SSECustomerKey: storage.calculateSSECustomerKey()
      }).send(function(err, data) {
        if (err) {
          log.error(err, 'Failed to download data from S3 from region [%s] for bucket [%s] and key [%s]', fileConfig.region, fileConfig.bucket, fileConfig.key);
          cb('Failed to download data from S3', null);
        } else {
          var dataStream = new stream.PassThrough();
          dataStream.end(data.Body);

          if (fileConfig.encryption != 'none') {
            log.info('Applying %s decryption after download', fileConfig.encryption);
            dataStream = dataStream.pipe(crypto.createDecipher(fileConfig.encryption, storage.calculateEncryptionKey(privatePair)));
          }

          cb(null, dataStream);
        }
      });
    },

    save: function(userId, privatePair, fileName, dataStream, updates, cb) {
      pre.notNull(userId);
      pre.notNull(privatePair);
      pre.notNull(fileName);
      pre.notNull(dataStream);
      pre.notNull(updates);
      pre.notNull(cb);

      if (encryption != 'none') {
        log.info('Applying %s encryption before upload', encryption);
        dataStream = dataStream.pipe(crypto.createCipher(encryption, storage.calculateEncryptionKey(privatePair)));
      }

      var key = path.join(userId, moment.utc().format(), fileName);

      log.info('Uploading data to AWS S3 to region [%s] for bucket [%s] and key [%s]', region, bucket, key);

      new aws.S3(_.merge(awsCredentials, {
        region: region,
        sslEnabled: true
      })).upload({
        Bucket: bucket,
        Key: key,
        SSECustomerAlgorithm: 'AES256',
        SSECustomerKey: storage.calculateSSECustomerKey(),
        Body: dataStream.pipe(new stream.PassThrough())
      }).send(function(err, data) {
        if (err) {
          log.error(err, 'Failed to upload data to S3 to region [%s] for bucket [%s] and key [%s]', region, bucket, key);
          cb('Failed to upload data to S3', null);
        } else {
          log.info('Done uploading data to AWS S3 to region [%s] for bucket [%s] and key [%s]', region, bucket, key);

          if (encryption != 'none') {
            key = storage.encrypt(key, 'aes256', privatePair).toString('hex');
          }

          updates._userId = userId;
          updates._storage = {type: type, encryption: encryption, region: region, bucket: bucket, key: key};

          cb(null, updates);
        }
      });
    }
  };
};
