
var log = require('../log')(__filename);
module.exports = function discover (config, app) {
  var hakken = app.hakken;
  var host = hakken.watchFromConfig(config.sandcastle.serviceSpec || 'sandcastle');
  host.start(function ( ) {
    log.info('FIRST SANDCASTLE LOOKUP', host.get( ));
  });
  return host;
}

