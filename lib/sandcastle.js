var url = require('url');

var _ = require('lodash');
var async = require('async');
var Busboy = require('busboy');
var diasend = require('animas-diasend-data');
var es = require('event-stream');
var mmcsv = require('mmcsv-carelink-data');
var request = require('request');

var log = require('./log.js')('sandcastle.js');


function parseForm(req, cb) {
  // configure a stream based on busboy
  var form = new Busboy({headers: req.headers});
  // we want to emit a single memo at the end of the stream with all our
  // interesting data ready to go
  var memo = {};
  form.on('file', function (name, file, filename, encoding, mimetype) {
    // Buffer dexcom file in memory while we process the rest of the arguments
    if (name === 'dexcom') {
      memo[name] = file.pipe(es.through().pause());
      memo.dexcom.encoding = encoding;
      memo.dexcom.name = filename;
      memo.dexcom.type = mimetype;
    } else {
      // resume() the ignored streams, otherwise busboy won't fire the 'finish' event.
      file.resume();
    }
  });

  // also use any POSTed parameters
  form.on('field', function (name, value) {
    memo[name] = value;
  });

  // re-emit only the memo at the end of handling all uploads with our
  // selected data attached
  form.on('end', function (err, results) {
    cb(err, memo);
  });

  req.pipe(form);
}

module.exports = function (sandcastleGetter, uploads) {

  function getHost() {
    var hostSpecs = sandcastleGetter.get();
    if (hostSpecs.length < 1) {
      return null;
    }
    return url.format(hostSpecs[0]);
  }

  return {
    ingest: function (req, meta, cb) {
      function fetchCarelinkAndOrDiasend(memo, cb) {
        // Fetch carelink and/or diasend data
        memo.user = meta;
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
          memo.carelink = mmcsv.fetch(
            {
              username: memo.carelinkUsername,
              password: memo.carelinkPassword,
              days: memo.days || 90
            }
          );
          delete memo.carelinkUsername;
          delete memo.carelinkPassword;
        }
        cb(null, memo);
      }

      function sendToSandcastle(data, cb) {
        var host = getHost();
        if (host == null) {
          return detach({ statusCode: 503, message: "Cannot find a sandcastle server" });
        }

        var opts = {
          method: 'POST',
          uri: host + '/uploads/' + meta.groupId + '/upload',
          qs: { message: 'upload to sandcastle', form: {} }
        };

        var req = request.post(opts, function (err, res, body) {
          if (err != null) {
            return cb(err);
          }
          cb(null, JSON.parse(body));
        });
        var form = req.form();
        if (data.diasend) {
          form.append('diasend', data.diasend,
                      { 'content-type': 'application/vnd.ms-excel', filename: 'diasend.xls' });
        }
        if (data.carelink) {
          form.append('carelink', data.carelink,
                      { 'content-type': 'text/plain', filename: 'carelink.csv' });
        }
        if (data.dexcom) {
          form.append('dexcom', data.dexcom,
                      { 'content-type': data.dexcom.type, filename: 'dexcom' });
        }
      }

      async.waterfall(
        [
          function (cb) {
            parseForm(req, cb);
          },
          fetchCarelinkAndOrDiasend,
          sendToSandcastle
        ],
        function (err, archiveLocations) {
          if (err != null) {
            cb(err);
            return;
          }


          uploads.createTask(function (err, task) {
            task.syncTaskId = task._id;
            task.url = '/v1/synctasks/' + task._id;
            task.archive = archiveLocations;
            cb(null, task);
            uploads.updateTask(_.assign({}, task, {status: 'started'}), function (error) {
              if (error != null) {
                log.warn(error, 'Failure to update task[%j]', task);
              }
              uploads.ingest(task);
            });
          });
        }
      );
    }
  };
};