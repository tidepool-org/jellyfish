
var log = require('../log')(__filename);
module.exports = function discover (config, app) {
  var hakken = app.hakken;
  var host = hakken.randomWatch(config.sandcastle.discover || 'sandcastle');
  host.start(function ( ) {
    log.info('FIRST SANDCASTLE LOOKUP', host.get( ));
  });
  return host;
}

