var _ = require('lodash');
var async = require('async');
var Busboy = require('busboy');
var diasend = require('tidepool-animas-diasend-data');
var es = require('event-stream');
var mmcsv = require('tidepool-mmcsv-carelink-data');

var log = require('./log.js')('sandcastle.js');


function parseForm(req, cb) {
  // configure a stream based on busboy
  var busboy = new Busboy({headers: req.headers});
  // we want to emit a single memo at the end of the stream with all our
  // interesting data ready to go
  var memo = {};
  busboy.on('file', function (name, file, filename, encoding, mimetype) {
    if (name === 'dexcom') {
      var out = es.through(write, end);
      var bytesWritten = 0;
      function write (chunk) {
        bytesWritten += chunk.length;
        log.info('dexcom', bytesWritten);
        this.queue(chunk);
      }
      function end ( ) {
        log.info('Loaded dexcom data, [%s] bytes', bytesWritten);
        if (!bytesWritten) {
          this.emit('data', null);
        }
        this.end( );
      }
      // file.pipe(out);
      // out.pause( );
      // file.resume( );
      // memo.dexcom = es.pipeline(file, out);
      // memo.dexcom = file.pipe(out)
      memo.dexcom = file.pipe(out.pause( ));
      memo.dexcom.encoding = encoding;
      memo.dexcom.name = filename;
      memo.dexcom.type = mimetype;

      /*
      file.on('data', function(chunk){
        bytesWritten += chunk.length;
        out.write(chunk);
      });
      file.on('end', function(){
        log.info('Loaded dexcom data, [%s] bytes', bytesWritten);
        out.end();
        if (bytesWritten > 0) {
          memo[name] = out;
          memo.dexcom.encoding = encoding;
          memo.dexcom.name = filename;
          memo.dexcom.type = mimetype;
        }
      });
      */
    } else {
      // resume() the ignored streams, otherwise busboy won't fire the 'finish' event.
      file.resume();
    }
    // cb(null, memo);
  });

  // also use any POSTed parameters
  busboy.on('field', function (name, value) {
    memo[name] = value;
  });

  // re-emit only the memo at the end of handling all uploads with our
  // selected data attached
  busboy.on('end', function (err, results) {
    log.info('busboy done');
    cb(err, memo);
  });
  function finish (err, data) {
    log.info('finishing parseForm', err, data);
    // cb(null, memo);
  }

  req.pipe(busboy);
  es.pipeline(es.readArray([memo]), es.writeArray(finish));
}

module.exports = function (intermediateStorage, uploads) {
  return {
    ingest: function (req, meta, cb) {
      function fetchCarelinkAndOrDiasend(memo, cb) {
        memo.meta = meta;
        if (memo.diasendUsername && memo.diasendPassword) {
          log.info('Fetching Animas data for user[%s]', memo.diasendUsername);
          memo.diasend = diasend.download(
            {
              username: memo.diasendUsername,
              password: memo.diasendPassword,
              days: memo.days || 133
            }
          );
          memo.diasend.on('error', function (err) {
            log.error(err, 'anim error');
          });
          delete memo.diasendUsername;
          delete memo.diasendPassword;
        }
        if (memo.carelinkUsername && memo.carelinkPassword) {
          log.info('Fetching Carelink data for user[%s]', memo.carelinkUsername);
          var startTime = new Date().valueOf();
          var bytesPulled = 0;
          memo.carelink = mmcsv.fetch(
            {
              username: memo.carelinkUsername,
              password: memo.carelinkPassword,
              days: memo.days || 90
            }
          );
          memo.carelink.on('data', function(chunk){
            bytesPulled += chunk.length;
          });
          memo.carelink.on('end', function(){
            log.info('Carelink data pulled in [%s] millis.  Size [%s]', new Date().valueOf() - startTime, bytesPulled);
          });
          delete memo.carelinkUsername;
          delete memo.carelinkPassword;
        }
        cb(null, memo);
      }


      async.waterfall(
        [
          function (cb) {
            console.log('parseForm');
            parseForm(req, cb);
          },
          fetchCarelinkAndOrDiasend,
          function(memo, cb) {
            log.info('memo to store', memo);
            intermediateStorage.store(memo, function(err, archiveLocations){
              cb(err, archiveLocations, memo);
            });
          }
        ],
        function (err, archiveLocations, memo) {
          if (err != null) {
            cb(err);
            return;
          }

          uploads.createTask(function (err, task) {
            task.syncTaskId = task._id;
            task.path = '/v1/synctasks/' + task._id;
            task.meta = _.assign({}, meta, { archives: archiveLocations });
            cb(null, task);
            uploads.updateTask(_.assign({}, task, {status: 'pending'}), function (error) {
              if (error != null) {
                log.warn(error, 'Failure to update task[%j]', task);
              }
              uploads.ingest(task, function(error) {
                if (error != null) {
                  log.warn(error, 'Error on ingestion!');
                }
              });
            });
          });
        }
      );
    }
  };
};
