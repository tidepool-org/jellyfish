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

var _ = require('lodash');
var salinity = require('salinity');
var expect = salinity.expect;
var misc = require('../lib/misc.js');

describe('misc', function () {
  describe('generateHash will be the same as platform', function () {
    it('successfully returns a hash with one identity field', function () {
      const hash = misc.generateHash(['zero']);
      expect(hash).to.equal('+RlOc/npRZ40UOoQoXnN93qvppW+7NO5NEqY0RFiIkM=');
    });
    it('successfully returns a hash with three identity fields', function () {
      const hash = misc.generateHash(['alpha', 'bravo', 'charlie']);
      expect(hash).to.equal('dO3wei6LXqnM+oEql2hguPTmyM0+QnmIZPyxzlvL2xY=');
    });
    it('successfully returns a hash with five identity fields', function () {
      const hash = misc.generateHash(['one', 'two', 'three', 'four', 'five']);
      expect(hash).to.equal('8HUIFZUXmOuySpngHvl+fJECoeELTiCRxwNxxgDzmVQ=');
    });
    it('returns same hash as platform', function () {
      const hash = misc.generateHash(['1099e49b7e', 'Contour7800-5455830', '2018-01-11T13:25:00Z', 'smbg', 'mmol/L', '5.9']);
      expect(hash).to.equal('zDzfGi/9PRvFiTFjgkZ6+wWA+mvAAJQdza/gdb9GwZ4=');
    });
  });
});
