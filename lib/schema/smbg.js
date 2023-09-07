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

var schema = require('./schema.js');

var idFields = ['type', 'deviceId', 'time', 'value'];
schema.registerIdFields('smbg', idFields);
schema.registerFieldsForDuplicator('smbg', ['units', 'value']);

module.exports = schema.makeHandler('smbg', {
  schema: {
    deviceTime: schema.validDeviceTime,
    value: schema.isNumber,
    units: schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'),
    subType: schema.ifExists(schema.in('manual', 'linked', '')),
  },
  transform: function (datum, cb) {
    return cb(null, schema.convertUnits(datum, 'value'));
  },
});
