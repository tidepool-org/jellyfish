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

describe('schema/convertMgToMmolPrecision', function () {
    it('give the same presion as the platform does', function (done) {
      expect(schema.convertMgToMmolPrecision(180.0)).to.equal(9.99135);
      expect(schema.convertMgToMmolPrecision(122.0)).to.equal(6.77192);
      expect(schema.convertMgToMmolPrecision(100.0)).to.equal(5.55075);
      expect(schema.convertMgToMmolPrecision(69.0)).to.equal(3.83002);
      done();
    });
});
