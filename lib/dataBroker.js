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
var util = require('util');

var amoeba = require('amoeba');
var except = amoeba.except;

var schemaBuilder = require('./schema');
var uploadConfig = require('./schema/schemaEnv');
var schema = require('./schema/schema.js');

var log = require('./log.js')('dataBroker.js');

function checkDatumUpdatesSummary(datum) {
  // two years has a bit of padding, to allow for some calculation delay
  var twoYearsPast = new Date();
  twoYearsPast.setMonth(twoYearsPast.getMonth() - 23);
  twoYearsPast.setDate(twoYearsPast.getDate() - 20);

  var oneDayFuture = new Date();
  oneDayFuture.setDate(oneDayFuture.getDate() + 1);

  var datumTime = new Date(datum.time);

  log.info('checkDatumUpdatesSummary 5 for %s %s %s %s %s', twoYearsPast, oneDayFuture, datumTime, datum.type, datum.time);
  if (isNaN(datumTime)) {
    // play it safe, return false for unparsable date
    return false;
  }

  log.info('checkDatumUpdatesSummary 6 for %s ', datumTime < oneDayFuture);
  log.info('checkDatumUpdatesSummary 6 for %s ', datumTime > twoYearsPast);
  log.info('checkDatumUpdatesSummary 6 for %s ', datumTime > twoYearsPast);
  log.info('checkDatumUpdatesSummary 6 for %s ', datum.type == 'cbg');
  if (datum.type == 'cbg' && datumTime < oneDayFuture && datumTime > twoYearsPast){
    return true;
  }

  return false;
}

module.exports = function(streamDAO) {
  var schemas = schemaBuilder(streamDAO);
  var knownTypes = Object.keys(schemas).join(', ');

  return {
    addDatum: function(datum, cb) {
      var handler = schemas[datum.type];
      if (handler == null) {
        return cb(
          { statusCode: 400, message: util.format('Unknown type[%s], known types[%s]', datum.type, knownTypes) }
        );
      }
      /*
       * This is a hacky place to move this logic, but we need it to run
       * before schema validation is attempted (or else it's pointless)
       * so ¯\_(ツ)_/¯
       */
      if (datum.type === 'upload') {
        var versionStr = datum.version.toLowerCase();

        if (uploadConfig.minimumUploaderVersion !== null) {
          // TODO: longterm this check should be against a datamodel version
          // and also probably not a hard go/no-go check
          if (versionStr.indexOf('tidepool-uploader') !== -1) {
            var versionNum = versionStr.split(' ')[1];
            if (!schema.isValidVersion(versionNum, uploadConfig.minimumUploaderVersion)) {
              return cb({
                statusCode: 400,
                message: 'The minimum supported version is ['+uploadConfig.minimumUploaderVersion+']. Version ['+datum.version+'] is no longer supported.',
                code: 'outdatedVersion',
                errorField: 'version'
              });
            }
          }
        }
        else {
          return cb({
            statusCode: 400,
            message: 'No minimum uploader version configured!',
            code: 'minUploaderVersionNotConfigured',
            errorField: 'version'
          });
        }
      }

      handler(datum, function(err, toAdd) {
        if (err != null) {
          return cb(err);
        }

        if (! Array.isArray(toAdd)) {
          toAdd = [toAdd];
        }

        var datumUpdatesSummary = false;

        async.mapSeries(
          toAdd,
          function(item, cb) {
            if (checkDatumUpdatesSummary(item) == true) {
              datumUpdatesSummary = true;
            }
            log.info('checkDatumUpdatesSummary 3 for %s =%s ', checkDatumUpdatesSummary(item), datumUpdatesSummary);
            streamDAO.addOrUpdateDatum(item, cb);
          },
          function(err) {
            log.info('datumUpdatesSummary 4 =%s ', datumUpdatesSummary);
            cb(err, datumUpdatesSummary);
          }
        );
      });
    }
  };
};