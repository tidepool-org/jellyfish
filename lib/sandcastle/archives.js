var es = require('event-stream')
  , request = require('request')
  , url = require('url')
  ;

var log = require('../log.js')(__filename);
var mmcsv = require('mmcsv-carelink-data')
  , diasend = require('animas-diasend-data')
  ;

function fetchMM (memo) {
  var raw = es.through( );
  var user = memo.carelinkUsername;
  var pass = memo.carelinkPassword;
  var days = memo.days || 90;
  var login = {
    username: user
  , password: pass
  , days: days
  };
  return mmcsv.fetch(login);
}

function fetchAnimas (memo) {
  var login = {
    username: memo.diasendUsername
  , password: memo.diasendPassword
  , days: memo.days || 133
  };
  return diasend.download(login).pipe(es.through( ));
}

module.exports = function configure (meta, host) {
  var base = url.format(host.get( ).shift( ));
  var opts = {
    uri: base + '/uploads/' + (meta.handle || meta.groupId) + '/upload'
  , method: 'POST'
  };
  log.info("UPLOAD service chosen", opts);

  function organize (memo, next) {
    memo.user = meta;
    log.info('organizing memo', memo);
    if (memo.diasendUsername && memo.diasendPassword) {
      memo.diasend = fetchAnimas(memo);
      memo.diasend.on('data', function (d) {
        log.info('anim data', d.length);
      });
      memo.diasend.on('error', function (d) {
        log.error('anim error', d);
      });
      delete memo.diasendUsername;
      delete memo.diasendPassword;
      log.info('set up diasend');
    }
    if (memo.carelinkUsername && memo.carelinkPassword) {
      memo.carelink = fetchMM(memo).pipe(es.through( ));
      delete memo.carelinkUsername;
      delete memo.carelinkPassword;
      log.info('set up carelink');
    }
    log.info('done organizing archive');
    next(null, memo);
  }

  function send (data, next) {
    log.info("SEND ARCHIVING");
    opts.qs = {message: 'upload to sandcastle', form: { } };
    var req = request.post(opts, response);
    var form = req.form( );
    if (data.diasend) {
      log.info('archive diasend');
      form.append('diasend', data.diasend,
          { 'content-type': 'application/vnd.ms-excel', filename: 'diasend.xls' });
    }
    if (data.carelink) {
      log.info('archive carelink');
      form.append('carelink', data.carelink,
          { 'content-type': 'text/plain', filename: 'carelink.csv' });
    }
    if (data.dexcom) {
      log.info('archive dexcom');
      form.append('dexcom', data.dexcom,
          { 'content-type': data.dexcom.type, filename: 'dexcom' });
    }

    function response (err, res, body) {
      try {
        var json = JSON.parse(body);
        log.info("ARCHIVE finished sending", err, body);
        data.archive = json;
        next(null, data);
      } catch (e) {
        log.info("ERROR parsing", err, body, res);
        next(err);
      }
    }
  }

  var stream = es.pipeline(es.map(organize), es.map(send));
  stream.on('error', function ( ) { log.error('ARCHIVE ERROR', arguments); });
  return stream;
}
