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

const async = require('async');

function attachSchemas(schemas) {
  for (var i = 1; i < arguments.length; ++i) {
    schemas[arguments[i].key] = arguments[i];
  }
  // The original schemas object was just an object that had keys based on the type of datum.
  // It was meant for modifications to one datum at a time.
  // For BACK-5342 this allows processing data in an array all of the same type but
  // with a different subTypes / subWhateverField that needs to operate on all of them
  // at once.

  schemas.getArrayHandler = (type) => {
    if (!schemas[type]) {
      return null;
    }

    const handler = schemas[type];
    return (data, cb) => {
      if (!data) {
        return cb(Error('must supply data to handler'));
      }
      if (!Array.isArray(data)) {
        data = [data];
      }
      if (data.some(x => x.type != data[0].type)) {
        return cb(Error('all data must be the same type for a single handler'));
      }

      async.map(
        data,
        handler,
        (err, items) => {
          if (err) {
            return cb(err);
          }
          // Flatten items as handler may or may not have returned an array from a single object.
          let newItems = [];
          for (const item of items) {
            if (Array.isArray(item)) {
              newItems = newItems.concat(item);
            } else {
              newItems.push(item);
            }
          }
          handler.groupTransform(newItems, cb);
        }
      );
    };
  };

  return schemas;
}

module.exports = function(streamDAO) {
  return attachSchemas(
    {},
    require('./basal.js')(streamDAO),
    require('./bloodKetone.js'),
    require('./bolus.js')(streamDAO),
    require('./cbg.js'),
    require('./deviceEvent.js')(streamDAO),
    require('./food.js'),
    require('./grabbag.js'),
    require('./insulin.js'),
    require('./note.js')(streamDAO),
    require('./physicalActivity.js'),
    require('./smbg.js'),
    require('./reportedState.js'),
    require('./pumpSettings.js'),
    require('./cgmSettings.js'),
    require('./upload.js'),
    require('./urineKetone.js'),
    require('./wizard.js')
  );
};
