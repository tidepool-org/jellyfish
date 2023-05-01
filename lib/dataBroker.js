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

function checkDatumUpdatesSummary(updatesSummary, datum) {
  let twoYearsPast = new Date();
  twoYearsPast.setMonth(twoYearsPast.getMonth() - 24);

  let oneDayFuture = new Date();
  oneDayFuture.setDate(oneDayFuture.getDate() + 1);

  let datumTime = new Date(datum.time);

  if (isNaN(datumTime)) {
    // play it safe, don't set for unparsable date
    return;
  }

  console.log("checking type", datum.type);
  console.log("datum time", datum.time);

  console.log(datumTime, '<', oneDayFuture, '&&', datumTime, '>', twoYearsPast);
  console.log(datumTime < oneDayFuture && datumTime > twoYearsPast);
  if (datumTime < oneDayFuture && datumTime > twoYearsPast){
    if (datum.type === 'cbg') {
      updatesSummary.cgm = true;
    } else if (datum.type === 'smbg'){
      updatesSummary.bgm = true;
    }
  }

  console.log(updatesSummary);
}

module.exports = function(streamDAO) {
  var schemas = schemaBuilder(streamDAO);
  var knownTypes = Object.keys(schemas).join(', ');

  return {
    addDatum: function(datum, updatedSummary, cb) {
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

        let updatesSummary = {cgm: false, bgm: false};

        async.mapSeries(
          toAdd,
          function(item, cb) {
            checkDatumUpdatesSummary(updatesSummary, item);

            streamDAO.addOrUpdateDatum(item, cb);
          },
          function(err) {
            function summaryErrCb(err, typ) {
              if (err != null) {
                log.warn(err, 'Problem marking %s summary outdated for user[%s].', typ, datum._userId);
              }
            }

            console.log(updatesSummary);
            for (const typ in updatesSummary) {
              if (updatedSummary[typ] === false && updatesSummary[typ] === true) {
                streamDAO.setSummaryOutdated(datum._userId, typ, summaryErrCb);
                updatedSummary[typ] = true;
              }
            }

            cb(err);
          }
        );
      });
    }
  };
};