/*
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