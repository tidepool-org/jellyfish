var crypto = require('crypto');
var fs = require('fs');
var url = require('url');


var base32hex = require('amoeba').base32hex;
var diasend = require('tidepool-animas-diasend-data');
var dxcomParser = require('tidepool-dexcom-stream');
var es = require('event-stream');
var mmcsv = require('tidepool-mmcsv-carelink-data');
var mongojs = require('mongojs');
var moment = require('moment');
var request = require('request');

var config = require('../../env.js');
var log = require('../log.js')('children/ingest.js');

(function exec ( ) {
  // Connect to MongoDB
  var db = mongojs(config.mongoConnectionString, ['deviceData', 'groups','syncTasks']);
  // setup task helpers
  var tasks = require('../tasks')(db);

  // synchronize ingesting a task
  function sync (err, task) {
    log.info("syncing task data", task);
    // the json result from sandcastle is the archive
    var meta = task.meta;
    log.info('Deleting all data for group[%s]', meta.groupId);
    db.deviceData.remove({groupId: meta.groupId}, function(err){
      if (err != null) {
        throw err;
      }

      var start = es.readArray(meta.archives);
      es.pipeline(start, ingest(meta), es.writeArray(end));
    });
  }

  function download(downloadUrl) {
    log.info('Downloading[%s]', downloadUrl);
    var parsed = url.parse(downloadUrl);

    if (parsed.protocol == null) {
      // Assume it's a local file
      return fs.createReadStream(downloadUrl);
    } else {
      return request.get(downloadUrl, { rejectUnauthorized: false });
    }
  }

  function ingest (meta) {
    function iter (url, next) {
      var tail = url.split('/').pop( );
      var parses;
      // configure parse stream differently depending on the vendor
      if (tail === 'diasend.xls') {
        parses = es.pipeline(animas(), markup('animas', meta));
      }
      if (tail === 'carelink.csv') {
        parses = es.pipeline(carelink(), markup('medtronic', meta));
      }
      if (tail === 'dexcom') {
        parses = es.pipeline(dexcom(), markup('dexcom', meta));
      }
      if (parses) {
        var fetching = download(url);
        var stream = es.pipeline(fetching, parses, persist());

        parses.on('error', function errors (err) {
          log.info(err, "ERROR", tail, parses);
          stream.end();
          next();
        });
        stream.pipe(es.writeArray(function done (err, results) {
          next(null, results);
        }));
        return;
      }
      next(null, url);
    }
    return es.map(iter);
  }

  function dexcom () {
    return dxcomParser.desalinate();
  }

  function carelink () {
    return mmcsv.desalinate();
  }

  function animas () {
    return es.pipeline(diasend.xls(), diasend.render());
  }

  // Through stream which adds details needed for tidepool/blip
  function markup (name, meta) {
    function iter (entry, next) {
      entry.groupId = meta.groupId;
      entry.company = name;
      next(null, entry);
    }
    return es.map(iter);
  }

  // Persist - a through stream which records every element in mongo db.
  function persist () {
  // * store results in mongo
    function iter (entry, next) {
      if (entry._id == null) {
        var hasher = crypto.createHash('sha1');
        hasher.update(entry.type);
        hasher.update(String(entry.value));
        hasher.update(entry.deviceTime);
        entry._id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
      }

      db.deviceData.save(entry, onSave);
      function onSave (err, entry) {
        next(err, entry);
      }
    }
    return es.map(iter);
  }

  // some basic record keeping at the end of the process
  function end (err, results) {
    var finis = 0;
    if (err) {
      finis = 255;
    }
    results.forEach(function (e, i) {
      log.info("File[%s] ingested [%s] records", i + 1, e.length);
    });
    log.info("ingest.js script finishing, processed [%s] files", results.length);
    process.exit(finis);
  }

  // start ingest process
  function main (id) {
    tasks.get(id, sync);
  }

  // Must run as $ node ./path/to/lib/children/ingest.js
  if (!module.parent) {
    var proc = process.argv.shift( );
    var script = process.argv.shift( );
    var taskId = process.argv.shift( );
    if (!taskId) {
      log.error('usage:', proc, script, '<task-id>');
      process.exit(1);
    }
    main(taskId);
  }
})();
