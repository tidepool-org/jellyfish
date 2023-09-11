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

/* global describe, before, beforeEach, it, after */

'use strict';

var _ = require('lodash');
var salinity = require('salinity');
var expect = salinity.expect;

var schema = require('../../lib/schema/schema.js');

describe('schema/duplicate.js', function () {
  describe('registerFieldsForDuplicator', function () {
    it('adds custom fields for a type', function (done) {
      try {
        schema.registerFieldsForDuplicator('mytype', ['value']);
      } catch (error) {
        done(error);
      }
      done();
    });
    it('errors if the type is already registered', function (done) {
      try {
        schema.registerFieldsForDuplicator('mytype', ['value']);
      } catch (error) {
        expect(error.message).to.equal(
          'Id hash fields for type[mytype] already defined[["_userId","deviceId","time","type","value"]], cannot set[["value"]]'
        );
        done();
      }
    });
    it('adds base fields for type', function (done) {
      schema.registerFieldsForDuplicator('myothertype');
      expect(JSON.stringify(schema.getIdHashFields('myothertype'))).to.equal(JSON.stringify([
        '_userId',
        'deviceId',
        'time',
        'type',
      ]));
      done();
    });
  });
  describe('generateHash', function () {
    var reference = {
      type: 'test-datum',
      time: new Date('2013-11-27'),
      timezoneOffset: 120,
      deviceId: 'test',
      uploadId: 'test',
      value: 1.12,
      units: 'mmol/L',
      _userId: 'u',
      _groupId: 'g',
    };
    before(function (done) {
      schema.registerFieldsForDuplicator('test-datum', ['units', 'value']);
      done();
    });
    it('generates hash from registered fields', function (done) {
      const hashed = schema.generateHash(reference);
      expect(hashed).to.equal('ZKCTDPCV0bDi7B2SxXBQypsBueCLi1ZHp+aLWjhwhrE=');
      done();
    });
    it('errors if missing a required field', function (done) {
      const referenceCopy = reference;
      delete referenceCopy._userId;
      try {
        schema.generateHash(referenceCopy);
      } catch (error) {
        expect(error.message).to.equal(
          "Can't generate hash, field[_userId] didn't exist on datum of type[test-datum]"
        );
        done();
      }
    });
  });
});
