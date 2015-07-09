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

describe('local', function() {
  var directory;
  var env;
  var storage;

  before(function() {
    directory = path.resolve('./testdata');
    env = {
      awsCredentials: {
        accessKeyId: 'accessKey',
        secretAccessKey: 'secretAccessKey'
      },
      storage: {
        types: {
          local: {
            type: 'local',
            encryption: 'none',
            directory: directory
          }
        },
        default: 'local'
      },
      saltDeploy: 'XYZ'
    };
    storage = require('../../lib/storage')(env);
  });

  after(function() {
    files.rmdirsSync(directory);
  });

  describe('exports', function() {
    var subject;

    beforeEach(function() {
      subject = require('../../lib/storage/local.js');
    });

    it('should throw an Error when the storage is null', function() {
      expect(subject.bind(null, {type: 'local', encryption: 'none', directory: directory})).to.throw(Error);
    });

    it('should throw an Error when the storageConfig is null', function() {
      expect(subject.bind(storage, null)).to.throw(Error);
    });

    it('should throw an Error when the local storage config does not contain a type', function() {
      expect(subject.bind(storage, {encryption: 'none', directory: directory})).to.throw(Error);
    });

    it('should throw an Error when the local storage config does not contain an encryption', function() {
      expect(subject.bind(storage, {type: 'local', directory: directory})).to.throw(Error);
    });

    it('should throw an Error when the local storage config does not contain an directory', function() {
      expect(subject.bind(storage, {type: 'local', encryption: 'none'})).to.throw(Error);
    });

    it('should throw an Error when the local storage config contains an unknown type', function() {
      expect(subject.bind(storage, {type: 'unknown', encryption: 'none', directory: directory})).to.throw(Error);
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
      subject = require('../../lib/storage/local.js')(storage, env.storage.types.local);
      text = crypto.pseudoRandomBytes(32).toString('hex');
      fileName = crypto.pseudoRandomBytes(16).toString('hex');
    });

    describe('#type', function() {
      it('should return the local type', function() {
        expect(subject.type()).to.equal('local');
      });
    });

    describe('#get', function() {
      var filePath;
      var fileConfig;
      var writeDataToFilePath;

      beforeEach(function() {
        filePath = path.join(directory, fileName);
        writeDataToFilePath = function(filePath, data, done) {
          fs.writeFile(filePath, data, {encoding: 'binary'}, function(err) {
            if (err) {
              throw Error(err);
            }
            done();
          });
        };
      });

      afterEach(function(done) {
        fs.unlink(filePath, function() {
          done();
        });
      });

      describe('without encryption', function() {
        beforeEach(function(done) {
          fileConfig = {
            encryption: 'none',
            path: filePath
          };
          writeDataToFilePath(filePath, text, done);
        });

        it('should throw an Error when the fileConfig is null', function() {
          expect(subject.get.bind(null, privatePair, function(err, dataStream) {})).to.throw(Error);
        });

        it('should throw an Error when the cb is null', function() {
          expect(subject.get.bind(fileConfig, privatePair, null)).to.throw(Error);
        });

        it('should return an instance of a stream and return the text', function(done) {
          subject.get(fileConfig, null, function(err, dataStream) {
            expect(err).to.be.null;
            expect(dataStream).to.not.be.null;
            dataStream.on('data', function(data) {
              expect(data.toString()).to.equal(text);
              done();
            });
            expect(dataStream.read()).to.be.null;
          });
        });

        it('should return an error when the file does not exist', function(done) {
          fileConfig.path += 'missing';
          subject.get(fileConfig, null, function(err, dataStream) {
            expect(err).to.be.instanceOf(Error);
            expect(dataStream).to.be.null;
            done();
          });
        });
      });

      describe('with encryption', function() {
        beforeEach(function(done) {
          fileConfig = {
            encryption: 'aes256',
            path: storage.encrypt(filePath, 'aes256', privatePair).toString('hex')
          };
          writeDataToFilePath(filePath, storage.encrypt(text, 'aes256', privatePair), done);
        });

        it('should throw an Error when the fileConfig is null', function() {
          expect(subject.get.bind(null, privatePair, function(err, dataStream) {})).to.throw(Error);
        });

        it('should throw an Error when the privatePair is null', function() {
          expect(subject.get.bind(fileConfig, null, function(err, dataStream) {})).to.throw(Error);
        });

        it('should throw an Error when the cb is null', function() {
          expect(subject.get.bind(fileConfig, privatePair, null)).to.throw(Error);
        });

        it('should return an instance of a stream and return the text', function(done) {
          subject.get(fileConfig, privatePair, function(err, dataStream) {
            expect(err).to.be.null;
            expect(dataStream).to.not.be.null;
            dataStream.on('data', function(data) {
              expect(data.toString()).to.equal(text);
              done();
            });
            expect(dataStream.read()).to.be.null;
          });
        });

        it('should return an error when the file does not exist', function(done) {
          fileConfig.path = storage.encrypt(filePath + '.missing', 'aes256', privatePair).toString('hex');
          subject.get(fileConfig, privatePair, function(err, dataStream) {
            expect(err).to.be.instanceOf(Error);
            expect(dataStream).to.be.null;
            done();
          });
        });
      });
    });

    describe('#save', function() {
      var dataStream;
      var updates;

      beforeEach(function() {
        dataStream = new stream.Readable();
        dataStream.push(text);
        dataStream.push(null);
        updates = {};
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
        expect(subject.save.bind(userId, privatePair, fileName, dataStream, null, null)).to.throw(Error);
      });

      it('should save the file without encryption and return the appropriate info in the updates', function(done) {
        subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {
          expect(err).to.be.null;
          expect(updates).to.not.be.null;
          expect(updates._userId).to.equal(userId);
          expect(updates._storage.type).to.equal('local');
          expect(updates._storage.encryption).to.equal('none');
          expect(updates._storage.path).to.not.be.null;
          expect(fs.readFileSync(updates._storage.path).toString()).to.equal(text);
          done();
        });
      });

      it('should save the file with encryption and return the appropriate info in the updates', function(done) {
        var storageConfig = _.cloneDeep(env.storage.types.local);
        storageConfig.encryption = 'aes256';
        subject = require('../../lib/storage/local.js')(storage, storageConfig);
        subject.save(userId, privatePair, fileName, dataStream, updates, function(err, updates) {
          expect(err).to.be.null;
          expect(updates).to.not.be.null;
          expect(updates._userId).to.equal(userId);
          expect(updates._storage.type).to.equal('local');
          expect(updates._storage.encryption).to.equal('aes256');
          expect(updates._storage.path).to.not.be.null;
          var decryptedPath = storage.decrypt(new Buffer(updates._storage.path, 'hex'), 'aes256', privatePair);
          expect(path.basename(decryptedPath)).to.equal(fileName);
          var decryptedText = storage.decrypt(fs.readFileSync(decryptedPath), 'aes256', privatePair);
          expect(decryptedText).to.equal(text);
          done();
        });
      });
    });
  });
});
