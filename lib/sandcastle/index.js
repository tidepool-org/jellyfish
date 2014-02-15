
var discover = require('./discover');
var mimes = require('./mimes');
var archives = require('./archives');
var es = require('event-stream');
var log = require('../log')(__filename);

function Payload (req, host) {
  this.req = req;
  this.host = host;
  return this;
}

function start (meta, uploads, status) {
  // console.log('meta', meta, "host", this.host.get( ));
  // * stream content to sandcastle
  var incoming = this.req;
  log.info('organize mimes');
  var parts = mimes(meta, this.req.headers, this.host);
  log.info('setup archive');
  var archive = archives(meta, this.host);
  log.info('config mime piped to storage');
  var storage = es.pipeline(parts, archive);

  log.info('set up pending');
  var pending = uploads.start(incoming, storage, status);
  log.info('sync');
  sync(storage, pending);

}

function sync (storage, pending) {
  storage.on('data', function ( ) {
    log.info("storage pending");
    pending.write({stage: 'archiving', status: 'pending' });
  });
  storage.pipe(es.writeArray(function (err, results) {
    var archive = results.pop( );
    log.info("SYNC", err, archive);
    // this kicks off next stage, ingesting
    pending.write({stage: 'fetching', status: 'archived', data: archive});
  }));
}

function createHostPayload (hosts) {
  function payload (req) { return new Payload(req, hosts); }
  return payload;
}

Payload.prototype.start = start;
function create (config, app) {
  // * discover sandcastle
  var hosts = discover(config, app);
  return {payload: createHostPayload(hosts)};
}

module.exports = function config (config, app) {
  return create(config, app);
}

