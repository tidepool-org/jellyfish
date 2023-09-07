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

var idFields = ['type', 'time', 'creatorId', 'text', 'deviceId'];
schema.registerIdFields('note', idFields);
schema.registerFieldsForDuplicator('note');

module.exports = function(streamDAO){
  return schema.makeHandler('note', {
    schema: {
      shortText: schema.ifExists(schema.isString),
      text: schema.isString,
      creatorId: schema.isString,
      reference: schema.ifExists(schema.or(schema.isObject, schema.isString)),
      displayTime: schema.ifExists(schema.isString)
    },
    transform: function(datum, cb) {
      if (datum.reference != null) {
        datum.reference = schema.makeId(datum.reference);
        streamDAO.getDatum(datum.reference, datum._groupId, function(err, referee) {
          if (err != null) {
            return cb(err);
          }

          if (datum.displayTime == null) {
            datum.displayTime = datum.time;
          }
          datum.time = referee.time;

          cb(null, datum);
        });
      } else {
        cb(null, datum);
      }
    }
  });
};