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

var path = require('path');

var amoeba = require('amoeba');
var salinity = require('salinity');

var expect = salinity.expect;
var files = amoeba.files;

describe('storage', function() {
  var directory;

  before(function() {
    directory = path.resolve('./testdata');
  });

  after(function() {
    files.rmdirsSync(directory);
  });

  describe('exports', function() {
    var subject;

    beforeEach(function() {
      subject = '../lib/storage';
    });

    it('should return a function when required', function() {
      expect(require(subject)).to.not.be.null;
    });

    it('should throw an Error when passed a null env', function() {
      expect(require(subject).bind(null)).to.throw(Error);
    });

    it('should throw an Error when the env does not contain storage', function() {
      var env = {
        saltDeploy: 'XYZ'
      };
      expect(require(subject).bind(env)).to.throw(Error);
    });

    it('should throw an Error when the storage does not contain types', function() {
      var env = {
        storage: {
          default: 'local'
        },
        saltDeploy: 'XYZ'
      };
      expect(require(subject).bind(env)).to.throw(Error);
    });

    it('should throw an Error when the storage does not contain default', function() {
      var env = {
        storage: {
          types: {
            type: 'local',
            encryption: 'none',
            directory: directory
          }
        },
        saltDeploy: 'XYZ'
      };
      expect(require(subject).bind(env)).to.throw(Error);
    });

    it('should throw an Error when the env does not contain saltDeploy', function() {
      var env = {
        storage: {
          types: {
            type: 'local',
            encryption: 'none',
            directory: directory
          },
          default: 'local'
        },
        saltDeploy: 'XYZ'
      };
      expect(require(subject).bind(env)).to.throw(Error);
    });
  });

  describe('with an env', function() {
    var env;
    var subject;

    beforeEach(function() {
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
            },
            'aws/s3': {
              type: 'aws/s3',
              encryption: 'none',
              region: 'test-region',
              bucket: 'test-bucket'
            }
          },
          default: 'local'
        },
        saltDeploy: 'XYZ'
      };
      subject = require('../lib/storage')(env);
    });

    describe('#create', function() {
      it('should respond to create', function() {
        expect(subject).to.respondTo('create');
      });

      it('should throw an Error when the storage config is null', function() {
        expect(subject.create.bind(null)).to.throw(Error);
      });

      it('should throw an Error when the storage config does not contain type', function() {
        expect(subject.create.bind({})).to.throw(Error);
      });

      it('should return a local storage object when the storage type is local', function() {
        expect(subject.create({type: 'local', encryption: 'none', directory: directory}).type()).to.equal('local');
      });

      it('should return a aws/s3 storage object when the storage type is aws/s3', function() {
        expect(subject.create({type: 'aws/s3', encryption: 'none', region: 'test-region', bucket: 'test-bucket'}).type()).to.equal('aws/s3');
      });

      it('should throw an Error when the storage type is unknown', function() {
        expect(subject.create.bind({type: 'unknown'})).to.throw(Error);
      });
    });

    describe('#createType', function() {
      it('should respond to createType', function() {
        expect(subject).to.respondTo('createType');
      });

      it('should throw an Error when the storage type is null', function() {
        expect(subject.createType.bind(null)).to.throw(Error);
      });

      it('should return a local storage object when the storage type is local', function() {
        expect(subject.createType('local').type()).to.equal('local');
      });

      it('should return a aws/s3 storage object when the storage type is aws/s3', function() {
        expect(subject.createType('aws/s3').type()).to.equal('aws/s3');
      });

      it('should throw an Error when the storage type is unknown', function() {
        expect(subject.createType.bind('unknown')).to.throw(Error);
      });
    });

    describe('#createDefault', function() {
      it('should respond to createDefault', function() {
        expect(subject).to.respondTo('createDefault');
      });

      it('should return a local storage object when the default storage type is local', function() {
        env.storage.default = 'local';
        subject = require('../lib/storage')(env);
        expect(subject.createDefault().type()).to.equals('local');
      });

      it('should return a local storage object when the default storage type is aws/s3', function() {
        env.storage.default = 'aws/s3';
        subject = require('../lib/storage')(env);
        expect(subject.createDefault().type()).to.equals('aws/s3');
      });

      it('should throw an Error when the storage type is unknown', function() {
        env.storage.default = 'unknown';
        subject = require('../lib/storage')(env);
        expect(subject.createDefault.bind()).to.throw(Error);
      });
    });

    describe('#calculateEncryptionKey', function() {
      it('should respond to calculateEncryptionKey', function() {
        expect(subject).to.respondTo('calculateEncryptionKey');
      });

      it('should throw an Error when the private pair is null', function() {
        expect(subject.calculateEncryptionKey.bind(null)).to.throw(Error);
      });

      it('should throw an Error when the private pair hash is null', function() {
        expect(subject.calculateEncryptionKey.bind({})).to.throw(Error);
      });

      it('should create an encryption key', function() {
        expect(subject.calculateEncryptionKey({hash: 'ABCDEF'})).to.equal('d77c4f42690434ae1bb4d8b8e4cddd5e0c723696b96106e1954a5eeb4a709276');
      });
    });

    describe('#encrypt', function() {
      it('should respond to encrypt', function() {
        expect(subject).to.respondTo('encrypt');
      });

      it('should throw an Error when the value is null', function() {
        expect(subject.encrypt.bind(null, 'aes256', {hash: 'ABCDEF'})).to.throw(Error);
      });

      it('should throw an Error when the encryption is null', function() {
        expect(subject.encrypt.bind('Encrypted Text', null, {hash: 'ABCDEF'})).to.throw(Error);
      });

      it('should throw an Error when the privatePair is null', function() {
        expect(subject.encrypt.bind('Encrypted Text', 'aes256', null)).to.throw(Error);
      });

      it('should encrypt a string', function() {
        expect(subject.encrypt('Encrypted Text', 'aes256', {hash: 'ABCDEF'}).toString('hex')).to.equal('d2aab4e56b11426639cb2ee6a553d85e');
      });
    });

    describe('#decrypt', function() {
      it('should respond to decrypt', function() {
        expect(subject).to.respondTo('decrypt');
      });

      it('should throw an Error when the value is null', function() {
        expect(subject.decrypt.bind(null, 'aes256', {hash: 'ABCDEF'})).to.throw(Error);
      });

      it('should throw an Error when the encryption is null', function() {
        expect(subject.decrypt.bind(new Buffer.from('d2aab4e56b11426639cb2ee6a553d85e', 'hex'), null, {hash: 'ABCDEF'})).to.throw(Error);
      });

      it('should throw an Error when the privatePair is null', function() {
        expect(subject.decrypt.bind(new Buffer.from('d2aab4e56b11426639cb2ee6a553d85e', 'hex'), 'aes256', null)).to.throw(Error);
      });

      it('should decrypt an encrypted string', function() {
        expect(subject.decrypt(new Buffer.from('d2aab4e56b11426639cb2ee6a553d85e', 'hex'), 'aes256', {hash: 'ABCDEF'})).to.equal('Encrypted Text');
      });
    });
  });
});
