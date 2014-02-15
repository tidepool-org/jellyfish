
module.exports = function discover (config, app) {
  var hakken = app.hakken;
  var host = hakken.randomWatch(config.sandcastle.discover || 'sandcastle');
  host.start(function ( ) {
    console.log('SOONEST', host.get( ), arguments);
  });
  return host;
}

