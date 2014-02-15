var es = require('event-stream')
  , Busboy = require('busboy')
  ;

/**
 * Handle all raw http uploads
 */
module.exports = function configure (meta, headers) {
  // configure a stream based on busboy
  var form = new Busboy({headers: headers});
  // we want to emit a single memo at the end of the stream with all our
  // interesting data ready to go
  var memo = { };
  form.on('file', onFile);
  // we want to filter out anything we don't care about
  function onFile (name, file, filename, encoding, mimetype) {
    // attach dexcom input stream to the memo
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
  // also use any POSTed parameters
  function onField (name, value) {
    memo[name] = value;
  }
  form.on('field', onField);
  var ingress = es.through( );
  var out = es.through( );
  form.on('end', done);

  // re-emit only the memo at the end of handling all uploads with our
  // selected data attached
  function done (err, results) {
    out.write(memo);
    out.end( );
  }
  var stream = es.duplex(form, out);
  return stream;
}

