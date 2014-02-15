var es = require('event-stream')
  , request = require('request')
  , url = require('url')
  ;

var mmcsv = require('mmcsv-carelink-data')
  , diasend = require('animas-diasend-data')
  ;

function fetchMM (memo) {
  var raw = es.through( );
  function parsed (err, results) {
    // throw away function, needed for legacy reasons
  }
  var user = memo.carelinkUsername;
  var pass = memo.carelinkPassword;
  var days = memo.days || 133;
  mmcsv.fetch(user, pass, days, parsed, raw);
  return es.pipeline(raw, es.through( ));
}

function fetchAnimas (memo) {
  var login = {
    username: memo.diasendUsername
  , password: memo.diasendPassword
  , days: memo.days || 133
  };
  return diasend.download(login)
}

module.exports = function configure (meta, host) {
  var base = url.format(host.get( ).shift( ));
  var opts = {
    uri: base + '/uploads/' + (meta.handle || meta.groupId) + '/upload'
  , method: 'POST'
  , headers: {
      'hakken-service': 'sandbox'
    }
  };

  function organize (memo, next) {
    memo.user = meta;
    if (memo.diasendUsername && memo.diasendPassword) {
      memo.diasend = fetchAnimas(memo);
    }
    if (memo.carelinkUsername && memo.carelinkPassword) {
      memo.carelink = fetchMM(memo);
      delete memo.carelinkUsername;
      delete memo.carelinkPassword;
    }
    next(null, memo);
  }

  function send (data, next) {
    // console.log("SEND ARCHIVING");
    opts.qs = {message: 'upload to sandcastle', form: { } };
    var req = request.post(opts, response);
    var form = req.form( );
    if (data.diasend) {
      form.append('diasend', data.diasend,
          { 'content-type': 'application/vnd.ms-excel', filename: 'diasend.xls' });
    }
    if (data.carelink) {
      form.append('carelink', data.carelink,
          { 'content-type': 'text/plain', filename: 'carelink.csv' });
    }
    if (data.dexcom) {
      // console.log('DEXCOM', data.dexcom);
      form.append('dexcom', data.dexcom,
          { 'content-type': data.dexcom.type, filename: 'dexcom' });
    }
    // TODO: with Nico, capture summary of upload?
    // form.append('foobar', es.readArray(["this is my content"], {filename: 'foobar', 'content-type': 'text/plain'}));

    function response (err, res, body) {
      try {
        var json = JSON.parse(body);
        // console.log("ARCHIVED", json, arguments);
        data.archive = json;
        next(null, data);
      } catch (e) {
        console.log("ERROR parsing", body);
        next(e);
      }
    }
  }

  var stream = es.pipeline(es.map(organize), es.map(send));
  stream.on('error', function ( ) { console.log('ARCHIVE ERROR', arguments); });
  return stream;
}
