/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');

var retVal = {data: []};

module.exports = function(baseDAO) {

  retVal.DAO = _.clone(baseDAO);

  retVal.DAO.addOrUpdateDatum = function(datum, cb) {
    retVal.data.push(datum);
    baseDAO.addOrUpdateDatum(datum, cb);
  };

  return retVal;
};