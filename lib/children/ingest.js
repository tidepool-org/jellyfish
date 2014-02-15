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

(function exec ( ) {
// Connect to MongoDB
  var db = mongojs(config.mongoConnectionString, ['deviceData', 'groups','syncTasks']);
  var hakken = require('hakken')(config.discovery).client( );
  var tasks = require('../tasks')(db);

  function sync (err, task) {
    log.info("syncing task data", task.data);
    var archive = task.data.archive;
    var starter = [ ];
    log.info('archive', archive);
    log.info('contents', archive.body.content);
    if (!err && archive && archive.body) {
      starter = archive.body.content;
    }
    archive.user = task.data.user;
    archive.sandcastle = hakken.randomWatch(config.sandcastle.discover);
    archive.sandcastle.start(function defer ( ) {
      var start = es.readArray(starter);
      archive.download = downloader(archive.sandcastle);
      es.pipeline(start, ingest(archive), es.writeArray(end));
    });
  }

  function downloader (watcher) {
    // return stream to download an url
    var base = url.format(watcher.get( ).shift( ));
    function download (url) {
      log.info('download url', url);
      var path = urlize.valid(url).pop( );
      var out = es.through( );
      var api = urlize(base, '/', path).toString( );
      log.info('download api', api);
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
          log.info("ERROR", err, parses);
          stream.end( );
          next( );
        });
        stream.pipe(es.writeArray(function done (err, results) {
          log.info("RESULTS PARSED?", results);
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

  // add details needed for tidepool/blip
  function markup (name, archive) {
    function iter (entry, next) {
      entry.groupId = archive.user.groupId;
      entry.company = name;
      next(null, entry);
    }
    return es.map(iter);
  }

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

  function main (id) {
    tasks.get(id, sync);
  }

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
