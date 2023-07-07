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
  const twoYearsPast = new Date(new Date().setMonth(new Date().getMonth() - 24));
  const oneDayFuture = new Date(new Date().setDate(new Date().getDate() + 1));

  let datumTime = new Date(datum.time);

  if (isNaN(datumTime)) {
    // play it safe, don't set for unparsable date
    return;
  }

  if (datumTime < oneDayFuture && datumTime > twoYearsPast){
    if (datum.type === 'cbg') {
      updatesSummary.cgm = true;
    } else if (datum.type === 'smbg'){
      updatesSummary.bgm = true;
    }
  }
}

module.exports = function(streamDAO) {
  var schemas = schemaBuilder(streamDAO);
  var knownTypes = Object.keys(schemas).join(', ');

  return {
    addData: function(dataOrDatum, updatedSummary, cb) {
      const firstDatum = Array.isArray(dataOrDatum) ? dataOrDatum[0] : dataOrDatum;

      const array = Array.isArray(dataOrDatum) ? dataOrDatum : [dataOrDatum];
      if (array.some(x => x.type != firstDatum.type)) {
        return cb(
          { statusCode: 400, message: util.format('all types must match if inserting more than one datum at once') });
      }

      // The checks beforehand already make sure all datum in dataOrDatum is of the
      // same type if it dataOrDatum is an array.
      var handler = schemas[firstDatum.type];
      if (handler == null) {
        return cb(
          { statusCode: 400, message: util.format('Unknown type[%s], known types[%s]', firstDatum.type, knownTypes) }
        );
      }
      /*
       * This is a hacky place to move this logic, but we need it to run
       * before schema validation is attempted (or else it's pointless)
       * so ¯\_(ツ)_/¯
       */
      if (firstDatum.type === 'upload') {
        for (const datum of array) {
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
      }

      handler(dataOrDatum, function(err, toAdd) {
        if (err != null) {
          return cb(err);
        }

        if (! Array.isArray(toAdd)) {
          toAdd = [toAdd];
        }

        let updatesSummary = {cgm: false, bgm: false};

        async.mapLimit(
          toAdd,
          50,
          function(item, cb) {
            checkDatumUpdatesSummary(updatesSummary, item);

            streamDAO.addOrUpdateDatum(item, cb);
          },
          function(err) {
            function summaryErrCb(err) {
              if (err != null) {
                log.warn(err, 'Problem marking summary outdated for user %s.', firstDatum._userId);
              }
            }

            for (const typ in updatesSummary) {
              if (updatedSummary[typ] === false && updatesSummary[typ] === true) {
                streamDAO.setSummaryOutdated(firstDatum._userId, typ, summaryErrCb);
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