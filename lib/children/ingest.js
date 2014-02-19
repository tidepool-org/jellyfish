var diasend = require('animas-diasend-data');
var dxcomParser = require('dexcom-stream');
var es = require('event-stream');
var mmcsv = require('mmcsv-carelink-data');
var mongojs = require('mongojs');
var moment = require('moment');
var request = require('request');
var urlize = require('nurlize');
var url = require('url');

var config = require('../../env.js');
var log = require('../log.js')(__filename);

// Wrap everything in a closure that executes immediately for no good
// reason.
(function exec ( ) {
  // Connect to MongoDB
  var db = mongojs(config.mongoConnectionString, ['deviceData', 'groups','syncTasks']);
  // setup hakken for client-side LB
  var hakken = require('hakken')(config.discovery).client( );
  // setup task helpers
  var tasks = require('../tasks')(db);

  // syncrhonize ingesting a task
  function sync (err, task) {
    log.info("syncing task data", task.data);
    // the json result from sandcastle is the archive
    var archive = task.data.archive;
    var starter = [ ];
    log.info('archive', archive);
    if (!err && archive && archive.body) {
      starter = archive.body.content;
    }
    archive.user = task.data.user;
    archive.sandcastle = hakken.randomWatch(config.sandcastle.discover);
    archive.sandcastle.start(function defer ( ) {
      // send our prepped archive into a stream configured to download
      // and parse data
      var start = es.readArray(starter);
      archive.download = downloader(archive.sandcastle);
      es.pipeline(start, ingest(archive), es.writeArray(end));
    });
  }

  function downloader (watcher) {
    // return stream to download an url
    // ~bewest has seen new instances pop up in between uploading and
    // ingesting, this allows switching to another host if hakken
    // tells us to do so.
    var base = url.format(watcher.get( ).shift( ));
    function download (url) {
      log.info('download url', url);
      var path = urlize.valid(url).pop( );
      var out = es.through( );
      var api = urlize(base, '/', path).toString( );
      log.info('download api', api);
      // fetch an archived file from sandcastle
      return es.pipeline(request.get(api), out);
    }
    return download;
  }

  function ingest (archive) {
    // * fetch content from sandcastle
    // var fetcher = es.through(write);
    // through might be better than map here
    function iter (url, next) {
      var tail = url.split('/').pop( );
      log.info('ingest url', url);
      log.info('inspect tail', tail);
      var parses;
      // configure parse stream differently depending on the vendor
      if (tail == 'diasend.xls') {
        parses = es.pipeline(animas( ), markup('animas', archive));
      }
      if (tail == 'carelink.csv') {
        parses = es.pipeline(carelink( ), markup('medtronic', archive));
      }
      if (tail == 'dexcom') {
        parses = es.pipeline(dexcom( ), markup('dexcom', archive));
      }
      if (parses) {
        var fetching = archive.download(url);
        var stream = es.pipeline(fetching, parses, persist(archive));

        parses.on('error', function errors (err) {
          log.info("ERROR", tail, err, parses);
          stream.end( );
          next( );
        });
        stream.pipe(es.writeArray(function done (err, results) {
          log.info("RESULTS PARSED?", tail, results);
          next(null, results);
        }));
        return;
      }
      next(null, url);
    }
    return es.map(iter);
  }

  function dexcom ( ) {
    var sugars = dxcomParser.sugars( );
    return sugars;
  }

  function carelink ( ) {
    return mmcsv.parse.all( );
  }

  function animas ( ) {
    return es.pipeline(diasend.xls( ), diasend.render( ));
  }

  // Through stream which adds details needed for tidepool/blip
  function markup (name, archive) {
    function iter (entry, next) {
      entry.groupId = archive.user.groupId;
      entry.company = name;
      next(null, entry);
    }
    return es.map(iter);
  }

  // Persist - a through stream which records every element in mongo
  // db.
  function persist (archive) {
  // * store results in mongo
    function iter (entry, next) {
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
    results.forEach(function (e) {
      log.info("ingested", e.length);
    });
    log.info("ENDING INGEST", results.length);
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
    log.info(proc, script, "WELCOME");
    if (!taskId) {
      log.error('usage:', proc, script, '<task-id>');
      process.exit(1);
    }
    log.info('using process.argv[%j]', taskId);
    log.info('[%j] QUERY HAKKEN', taskId);
    hakken.start( function defer ( ) {
      log.info('[%j] HAKKEN READY', taskId);
      main(taskId);
    })
  }
})( );
