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

var _ = require('lodash');
var async = require('async');

var log = require('./log.js')('jellyfishStreamDAO.js');

module.exports = function(baseDAO) {
  var dataBroker = require('./dataBroker.js')(baseDAO);

  var retVal = _.clone(baseDAO);

  retVal.storeData = function(data, callback) {
    if (! Array.isArray(data)) {
      data = [data];
    }

    async.mapSeries(
      data,
      function(datum, cb) {
        dataBroker.addDatum(datum, function(err){
          if (err != null) {
            if (err.errorCode === 'duplicate') {
              err = null;
            } else {
              log.info('Bad datum[%j]', datum);
            }
          }
          cb(err);
        });
      },
      callback
    );
  };

  return retVal;
};