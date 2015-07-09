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

/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var stream = require('stream');

var _ = require('lodash');

var amoeba = require('amoeba');
var salinity = require('salinity');

var expect = salinity.expect;
var files = amoeba.files;
var sinon = salinity.sinon;

var aws = require('aws-sdk');

describe('aws/s3', function() {
  var region = 'test-region';
  var bucket = 'test-bucket';
  var env;
  var storage;

  before(function() {
    env = {
      awsCredentials: {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey'
      },
      storage: {
        types: {
          'aws/s3': {
            type: 'aws/s3',
            encryption: 'none',
            region: region,
            bucket: bucket
          }
        },
        default: 'aws/s3'
      },
      saltDeploy: 'XYZ'
    };
    storage = require('../../../lib/storage')(env);
  });

  describe('exports', function() {
    var subject;

    beforeEach(function() {
      subject = require('../../../lib/storage/aws/s3.js');
    });

    it('should throw an Error when the storage is null', function() {
      expect(subject.bind(null, {type: 'aws/s3', encryption: 'none', region: region, bucket: bucket})).to.throw(Error);
    });

    it('should throw an Error when the storageConfig is null', function() {
      expect(subject.bind(storage, null)).to.throw(Error);
    });

    it('should throw an Error when the aws/s3 storage config does not contain a type', function() {
      expect(subject.bind(storage, {encryption: 'none', region: region, bucket: bucket})).to.throw(Error);
    });

    it('should throw an Error when the aws/s3 storage config does not contain an encryption', function() {
      expect(subject.bind(storage, {type: 'aws/s3', region: region, bucket: bucket})).to.throw(Error);
    });

    it('should throw an Error when the aws/s3 storage config does not contain a region', function() {
      expect(subject.bind(storage, {type: 'aws/s3', encryption: 'none', bucket: bucket})).to.throw(Error);
    });

    it('should throw an Error when the aws/s3 storage config does not contain a bucket', function() {
      expect(subject.bind(storage, {type: 'aws/s3', encryption: 'none', region: region})).to.throw(Error);
    });

    it('should throw an Error when the aws/s3 storage config contains an unknown type', function() {
      expect(subject.bind(storage, {type: 'unknown', encryption: 'none', region: region, bucket: bucket})).to.throw(Error);
    });
  });

  describe('with storage and storageConfig', function() {
    var userId;
    var privatePair;
    var subject;
    var text;
    var fileName;

    before(function() {
      userId = '111222333';
      privatePair = {
        id: '1234567890',
        hash: 'ABCDEF'
      };
    });

    beforeEach(function() {
      subject = require('../../../lib/storage/aws/s3.js')(aws, env, storage, env.storage.types['aws/s3']);
      text = crypto.pseudoRandomBytes(32).toString('hex');
      fileName = crypto.pseudoRandomBytes(16).toString('hex');
    });

    describe('#type', function() {
      it('should return the aws/s3 type', function() {
        expect(subject.type()).to.equal('aws/s3');
      });
    });

    describe('#get', function() {
      var s3;
      var getObject;
      var s3Stub;
      var getObjectStub;
      var sendStub;
      var fileConfig;
      var encryptedFileConfig;

      beforeEach(function() {
        s3 = {getObject: function() {}};
        getObject = {send: function() {}};
        s3Stub = sinon.stub(aws, 'S3').returns(s3);
        getObjectStub = sinon.stub(s3, 'getObject').returns(getObject);
        sendStub = sinon.stub(getObject, 'send', function(callback) {
          callback(null, {Body: text});
        });
        fileConfig = {
          encryption: 'none',
          region: region,
          bucket: bucket,
          key: 'key'
        };
        encryptedFileConfig = _.cloneDeep(fileConfig);
        encryptedFileConfig.encryption = 'aes256';
        encryptedFileConfig.key = storage.encrypt(encryptedFileConfig.key, encryptedFileConfig.encryption, privatePair).toString('hex');
      });

      afterEach(function() {
        aws.S3.restore();
      });

      it('should throw an Error when the fileConfig is null', function() {
        expect(subject.get.bind(null, privatePair, function(err, dataStream) {})).to.throw(Error);
      });

      it('should throw an Error when the file is not encrypted and the privatePair is null', function() {
        expect(subject.get.bind(encryptedFileConfig, null, function(err, dataStream) {})).to.throw(Error);
      });

      it('should throw an Error when the cb is null', function() {
        expect(subject.get.bind(fileConfig, privatePair, null)).to.to.throw(Error);
      });

      it('should not throw an Error when the file is not encrypted and all parameters are valid', function() {
        expect(subject.get(fileConfig, null, function(err, dataStream) {})).to.be.undefined;
      });

      it('should not throw an Error when the file is encrypted and all parameters are valid', function() {
        expect(subject.get(encryptedFileConfig, privatePair, function(err, dataStream) {})).to.be.undefined;
      });

      it('should return an Error if it fails to get', function(done) {
        sendStub.restore();
        sendStub = sinon.stub(getObject, 'send', function(callback) {
          callback('error', null);
        });
        subject.get(fileConfig, null, function(err, dataStream) {
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', fileConfig.region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(getObjectStub);
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Bucket', fileConfig.bucket));
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Key', fileConfig.key));
          sinon.assert.calledOnce(sendStub);
          expect(err).to.not.be.null;
          expect(dataStream).to.be.null;
          done();
        });
      });

      it('should get the file without encryption and return the appropriate info in the updates', function(done) {
        subject.get(fileConfig, null, function(err, dataStream) {
          expect(err).to.be.null;
          expect(dataStream).to.not.be.null;
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', fileConfig.region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(getObjectStub);
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Bucket', fileConfig.bucket));
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Key', fileConfig.key));
          sinon.assert.calledOnce(sendStub);
          dataStream.on('data', function(data) {
            expect(data.toString()).to.equal(text);
            done();
          });
        });
      });

      it('should get the file with encryption and return the appropriate info in the updates', function(done) {
        sendStub.restore();
        sendStub = sinon.stub(getObject, 'send', function(callback) {
          callback(null, {Body: storage.encrypt(text, 'aes256', privatePair)});
        });
        var encryptedFileConfig = _.cloneDeep(fileConfig);
        encryptedFileConfig.encryption = 'aes256';
        encryptedFileConfig.key = storage.encrypt(encryptedFileConfig.key, encryptedFileConfig.encryption, privatePair).toString('hex');
        subject.get(encryptedFileConfig, privatePair, function(err, dataStream) {
          expect(err).to.be.null;
          expect(dataStream).to.not.be.null;
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', fileConfig.region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(getObjectStub);
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Bucket', fileConfig.bucket));
          sinon.assert.calledWith(getObjectStub, sinon.match.has('Key', fileConfig.key));
          sinon.assert.calledOnce(sendStub);
          dataStream.on('data', function(data) {
            expect(data.toString()).to.equal(text);
            done();
          });
        });
      });
    });

    describe('#save', function() {
      var s3;
      var upload;
      var s3Stub;
      var uploadStub;
      var sendStub;
      var dataStream;
      var updates;

      beforeEach(function() {
        s3 = {upload: function() {}};
        upload = {send: function() {}};
        s3Stub = sinon.stub(aws, 'S3').returns(s3);
        uploadStub = sinon.stub(s3, 'upload').returns(upload);
        sendStub = sinon.stub(upload, 'send', function(callback) {
          callback();
        });
        dataStream = new stream.Readable();
        dataStream.push(text);
        dataStream.push(null);
        updates = {};
      });

      afterEach(function() {
        aws.S3.restore();
      });

      it('should throw an Error when the userId is null', function() {
        expect(subject.save.bind(null, privatePair, fileName, dataStream, updates, function(err, updates) {})).to.throw(Error);
      });

      it('should throw an Error when the privatePair is null', function() {
        expect(subject.save.bind(userId, null, fileName, dataStream, updates, function(err, updates) {})).to.throw(Error);
      });

      it('should throw an Error when the fileName is null', function() {
        expect(subject.save.bind(userId, privatePair, null, dataStream, updates, function(err, updates) {})).to.throw(Error);
      });

      it('should throw an Error when the dataStream is null', function() {
        expect(subject.save.bind(userId, privatePair, fileName, null, updates, function(err, updates) {})).to.throw(Error);
      });

      it('should throw an Error when the updates is null', function() {
        expect(subject.save.bind(userId, privatePair, fileName, dataStream, null, function(err, updates) {})).to.throw(Error);
      });

      it('should throw an Error when the cb is null', function() {
        expect(subject.save.bind(userId, privatePair, fileName, dataStream, updates, null)).to.throw(Error);
      });

      it('should not throw an Error when all parameters are valid', function() {
        expect(subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {})).to.be.undefined;
      });

      it('should return an Error if it fails to upload', function(done) {
        sendStub.restore();
        sendStub = sinon.stub(upload, 'send', function(callback) {
          callback('error');
        });
        subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {
          expect(err).to.not.be.null;
          expect(updates).to.be.null;
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(uploadStub);
          sinon.assert.calledWith(uploadStub, sinon.match.has('Bucket', bucket));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Key'));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Body'));
          sinon.assert.calledOnce(sendStub);
          done();
        });
      });

      it('should save the file without encryption and return the appropriate info in the updates', function(done) {
        subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {
          expect(err).to.be.null;
          expect(updates).to.not.be.null;
          expect(updates._userId).to.equal(userId);
          expect(updates._storage.type).to.equal('aws/s3');
          expect(updates._storage.encryption).to.equal('none');
          expect(updates._storage.region).to.equal(region);
          expect(updates._storage.bucket).to.equal(bucket);
          expect(updates._storage.key).to.not.be.null;
          expect(path.basename(updates._storage.key)).to.equal(fileName);
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(uploadStub);
          sinon.assert.calledWith(uploadStub, sinon.match.has('Bucket', bucket));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Key', updates._storage.key));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Body'));
          sinon.assert.calledOnce(sendStub);
          done();
        });
      });

      it('should save the file with encryption and return the appropriate info in the updates', function(done) {
        var encryptedStorageConfig = _.cloneDeep(env.storage.types['aws/s3']);
        encryptedStorageConfig.encryption = 'aes256';
        subject = require('../../../lib/storage/aws/s3.js')(aws, env, storage, encryptedStorageConfig);
        subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {
          expect(err).to.be.null;
          expect(updates).to.not.be.null;
          expect(updates._userId).to.equal(userId);
          expect(updates._storage.type).to.equal('aws/s3');
          expect(updates._storage.encryption).to.equal('aes256');
          expect(updates._storage.region).to.equal(region);
          expect(updates._storage.bucket).to.equal(bucket);
          expect(updates._storage.key).to.not.be.null;
          var decryptedKey = storage.decrypt(new Buffer(updates._storage.key, 'hex'), 'aes256', privatePair);
          expect(path.basename(decryptedKey)).to.equal(fileName);
          sinon.assert.calledOnce(s3Stub);
          sinon.assert.calledWith(s3Stub, sinon.match.has('accessKeyId', env.awsCredentials.accessKeyId));
          sinon.assert.calledWith(s3Stub, sinon.match.has('secretAccessKey', env.awsCredentials.secretAccessKey));
          sinon.assert.calledWith(s3Stub, sinon.match.has('region', region));
          sinon.assert.calledWith(s3Stub, sinon.match.has('sslEnabled', true));
          sinon.assert.calledOnce(uploadStub);
          sinon.assert.calledWith(uploadStub, sinon.match.has('Bucket', bucket));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Key', decryptedKey));
          sinon.assert.calledWith(uploadStub, sinon.match.has('Body'));
          sinon.assert.calledOnce(sendStub);
          done();
        });
      });
    });
  });
});
