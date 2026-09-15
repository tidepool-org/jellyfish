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

var async = require('async');
var bunyan = require('bunyan');
var util = require('util');

var schemaBuilder = require('./schema');
var uploadConfig = require('./schema/schemaEnv');
var schema = require('./schema/schema.js');

var log = require('./log.js')('dataBroker.js');

const summary = require('./summary.js');

module.exports = function(streamDAO, workClient) {
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

        var written = [];
        async.eachSeries(
          toAdd,
          function(item, cb) {
            streamDAO.addOrUpdateDatum(item, function(err) {
              if (err == null) {
                written.push(item);
              }
              cb(err);
            });
          },
          function(err) {
            cb(err, written);
          }
        );
      });
    },

    // createUploadPostprocessWork reports an upload to the platform data service, which
    // recalculates every summary of the user and requests an EHR synchronization. `batch` is the
    // request body, whose size tells whether more batches are expected; `stored` are the datums of
    // the batch the store holds once the request is handled, written by it or present already;
    // `uploadErr` is the error the upload failed with, if any. Only stored data other than upload
    // records is postprocessed, so a request that stored none, rejected or not, creates no work. The
    // upload is answered already, so a failure to create the work is logged, not reported.
    createUploadPostprocessWork(userId, batch, stored, uploadErr, cb) {
      if (!userId || !summary.needsPostprocessing(stored)) {
        return cb();
      }

      const reason = summary.getOutdatedReason(batch, uploadErr != null);
      const buffer = summary.getOutdatedBuffer(reason);
      const availableTime = buffer > 0 ? new Date(Date.now() + buffer) : null;

      workClient.createUploadPostprocessWork(userId, reason, availableTime, function(err) {
        if (err != null) {
          // Axios errors include the request configuration and server token. Serialize only
          // the diagnostic error fields before placing the error in a structured log record.
          log.error(
            { err: bunyan.stdSerializers.err(err), userId, reason, availableTime, stored: stored.length, uploadFailed: uploadErr != null },
            `Problem creating upload postprocess work for user ${userId}.`
          );
        }
        cb();
      });
    }
  };
};
