
var discover = require('./discover');
var mimes = require('./mimes');
var archives = require('./archives');
var es = require('event-stream');

function Payload (req, host) {
  this.req = req;
  this.host = host;
  return this;
}

function start (meta, uploads, status) {
  // console.log('meta', meta, "host", this.host.get( ));
  // * stream content to sandcastle
  var incoming = this.req;
  var parts = mimes(meta, this.req.headers, this.host);
  var archive = archives(meta, this.host);
  var storage = es.pipeline(parts, archive);

  var pending = uploads.start(incoming, storage, status);
  sync(storage, pending);

}

function sync (storage, pending) {
  storage.on('data', function ( ) {
    pending.write({stage: 'archiving', status: 'pending' });
  });
  storage.pipe(es.writeArray(function (err, results) {
    var archive = results.pop( );
    console.log("SYNC", archive);
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

