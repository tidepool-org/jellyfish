
var discover = require('./discover');
var mimes = require('./mimes');
var archives = require('./archives');
var es = require('event-stream');
var log = require('../log')(__filename);

// quick wrapper to store state and attach methods
function Payload (req, host) {
  this.req = req;
  this.host = host;
  return this;
}

/**
 * start - start capturing payload
 */
function start (meta, uploads, status) {
  // * stream content to sandcastle
  var incoming = this.req;
  log.info('organize mimes');
  var parts = mimes(meta, this.req.headers, this.host);
  log.info('setup archive');
  var archive = archives(meta, this.host);
  log.info('config mime piped to storage');
  var storage = es.pipeline(parts, archive);

  log.info('set up pending');
  // set up a pending stream configured to store all the incoming data in our
  // archived storage system (sandcastle)
  var pending = uploads.start(incoming, storage, status);
  log.info('sync');
  sync(storage, pending);

}

// synchronize what hapens when storage is finished.
function sync (storage, pending) {
  // this updates the pending stream with the current status of the storage
  // archive.
  storage.on('data', function ( ) {
    pending.write({stage: 'archiving', status: 'pending' });
  });
  // archive (sandcastle) has finished storing data, time to ingest
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

