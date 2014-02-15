var es = require('event-stream')
  , Busboy = require('busboy')
  ;

module.exports = function configure (meta, headers) {
  var form = new Busboy({headers: headers});
  var memo = { };
  form.on('file', onFile);
  function onFile (name, file, filename, encoding, mimetype) {
    if (name == 'dexcom') {
      memo[name] = file.pipe(es.through( ).pause( ));
      memo.dexcom.encoding = encoding;
      memo.dexcom.name = filename;
      memo.dexcom.type = mimetype;
    } else {
      // all files need "resume" in order to keep things flowing.
      file.resume( );
    }
  }
  function onField (name, value) {
    memo[name] = value;
  }
  form.on('field', onField);
  var ingress = es.through( );
  var out = es.through( );
  form.on('end', done);

  function done (err, results) {
    out.write(memo);
    out.end( );
  }
  var stream = es.duplex(form, out);
  return stream;
}

