/*
 * == BSD2 LICENSE ==
 */

var except = require('amoeba').except;

var log = require('../log.js')('/storage/index.js');

module.exports = function(storageConfig) {
  switch(storageConfig.type) {
    case 'local':
      log.info('Using local storage with config[%j]', storageConfig);
      return require('./local.js')(storageConfig);
    default:
      throw except.IAE('Unknown storage type[%s], known types are [\'local\', \'sandcastle\']', storageConfig.type);
  }
};