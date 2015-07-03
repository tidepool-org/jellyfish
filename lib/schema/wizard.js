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
var settings = require('./pumpSettings.js');

var idFields = ['type', 'deviceId', 'time'];
schema.registerIdFields('wizard', idFields);

var recommendedSchema = schema.and(
    schema.isObject,
    schema.ensureSchemaFn('recommended', {
        carb: schema.ifExists(schema.isNumber),
        correction: schema.ifExists(schema.isNumber),
        net: schema.ifExists(schema.isNumber)
       }
  )
);

module.exports = schema.makeHandler('wizard', {
  schema: {
    recommended: schema.ifExists(recommendedSchema),
    bgInput: schema.ifExists(schema.isNumber),
    carbInput: schema.ifExists(schema.isNumber),
    insulinOnBoard: schema.ifExists(schema.isNumber),
    insulinCarbRatio: schema.ifExists(schema.isNumber),
    insulinSensitivity: schema.ifExists(schema.isNumber),
    bgTarget: schema.ifExists(settings.bgTargetSchema),
    payload: schema.ifExists(schema.isObject),
    originUnits: schema.in('mmol/L', 'mmol/l', 'mg/dL', 'mg/dl'),
    bolus: schema.ifExists(schema.or(schema.isObject, schema.isString))
  },
  transform: function(datum, cb) {
    if (datum.bolus != null && typeof(datum.bolus) === 'object') {
      datum.bolus = schema.generateId(datum.bolus, schema.idFields('bolus'));
    }

    if (schema.normalizeUnitName(datum.originUnits) === 'mg/dL' && datum.bgTarget != null) {
      datum.bgTarget = settings.convertBgTargetUnits(datum.bgTarget);
    }

    schema.convertUnits(datum, 'bgInput', 'insulinSensitivity');
    return cb(null, schema.postConversionCleanup(datum));
  }
});