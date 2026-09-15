/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
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

 /* global describe, beforeEach, it */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

// addDatum, with the store stood in for by a double that records the datums it is asked to write
describe('dataBroker', function () {
  const cbg = {
    type: 'cbg',
    value: 100,
    units: 'mg/dL',
    deviceTime: '2014-01-01T02:00:00',
    time: '2014-01-01T00:00:00.000Z',
    timezoneOffset: 120,
    conversionOffset: 0,
    deviceId: 'test',
    uploadId: 'test',
    _userId: 'u',
    _groupId: 'g'
  };

  // A suspension whose previous one is in the store: its handler writes the previous one, now
  // ended, along with it.
  const previous = {
    type: 'deviceEvent',
    subType: 'status',
    status: 'suspended',
    reason: { suspended: 'automatic' },
    deviceTime: '2014-01-01T02:00:00',
    time: '2014-01-01T00:00:00.000Z',
    timezoneOffset: 120,
    conversionOffset: 0,
    deviceId: 'test',
    uploadId: 'test',
    _userId: 'u',
    _groupId: 'g'
  };
  const suspended = _.assign({}, previous, {
    reason: { suspended: 'manual' },
    deviceTime: '2014-01-01T03:00:00',
    time: '2014-01-01T01:00:00.000Z',
    previous: _.cloneDeep(previous)
  });

  const duplicate = { statusCode: 400, errorCode: 'duplicate', message: 'received a duplicate event' };

  let store;
  let failures;
  const streamDAO = {
    getDatum: function (id, groupId, cb) {
      cb(null, _.cloneDeep(previous));
    },
    addOrUpdateDatum: function (datum, cb) {
      const err = failures[store.length];
      store.push(datum);
      cb(err != null ? err : null, datum);
    }
  };
  const dataBroker = require('../lib/dataBroker.js')(streamDAO, {});

  beforeEach(function () {
    store = [];
    failures = {};
  });

  describe('addDatum', function () {
    it('should call back with the datum written', function (done) {
      dataBroker.addDatum(_.cloneDeep(cbg), function (err, written) {
        expect(err).to.not.exist;
        expect(store).to.have.lengthOf(1);
        expect(written).to.have.lengthOf(1);
        expect(written[0].type).to.equal('cbg');
        expect(written[0].id).to.exist;
        done();
      });
    });

    it('should call back with every datum its handler makes of one', function (done) {
      dataBroker.addDatum(_.cloneDeep(suspended), function (err, written) {
        expect(err).to.not.exist;
        expect(store).to.have.lengthOf(2);
        expect(written).to.have.lengthOf(2);
        expect(written[0].time).to.equal(previous.time);
        expect(written[1].time).to.equal(suspended.time);
        done();
      });
    });

    it('should call back with nothing written when the store rejects the datum', function (done) {
      failures[0] = duplicate;
      dataBroker.addDatum(_.cloneDeep(cbg), function (err, written) {
        expect(err).to.equal(duplicate);
        expect(written).to.be.empty;
        done();
      });
    });

    it('should call back with the datums written before the store failed', function (done) {
      failures[1] = duplicate;
      dataBroker.addDatum(_.cloneDeep(suspended), function (err, written) {
        expect(err).to.equal(duplicate);
        expect(store).to.have.lengthOf(2);
        expect(written).to.have.lengthOf(1);
        expect(written[0].time).to.equal(previous.time);
        done();
      });
    });

    it('should reject an unknown type without writing', function (done) {
      dataBroker.addDatum({ type: 'unknown', _userId: 'u', _groupId: 'g' }, function (err) {
        expect(err.statusCode).to.equal(400);
        expect(store).to.be.empty;
        done();
      });
    });
  });
});
