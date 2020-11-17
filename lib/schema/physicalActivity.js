/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('physicalActivity', idFields);

var durationHoursSchema = {
  value: schema.and(
    schema.isNumber,
    schema.greaterThanEq(0),
    schema.lessThanEq(168)
  ),
  units: schema.in('hours')
};

var durationMinutesSchema = {
  value: schema.and(
    schema.isNumber,
    schema.greaterThanEq(0),
    schema.lessThanEq(10080)
  ),
  units: schema.in('minutes')
};

var durationSecondsSchema = {
  value: schema.and(
    schema.isNumber,
    schema.greaterThanEq(0),
    schema.lessThanEq(604800)
  ),
  units: schema.in('seconds')
};

module.exports = schema.makeHandler('physicalActivity', {
  schema: {
    duration: schema.and(schema.isObject, schema.or(
      schema.ensureSchemaFn('duration', durationMinutesSchema),
      schema.ensureSchemaFn('duration', durationHoursSchema),
      schema.ensureSchemaFn('duration', durationSecondsSchema),
    ))
  }
});
