var fs = require('fs');
var path = require('path');

var amoeba = require('amoeba');
var async = require('async');
var files = amoeba.files;
var pre = amoeba.pre;

var log = require('../log.js')('storage/local.js');

function fileWriter(stream, path) {
  if (stream == null) {
    return function(cb){
      cb(null, null);
    }
  }

  return function(cb) {
    log.info('Writing data to file[%s]', path);
    out = fs.createWriteStream(path);
    out.on('error', function(err) {
      cb(err, null);
    });
    out.on('finish', function() {
      log.info('Done writing data to file[%s]', path);
      cb(null, path);
    });
    stream.pipe(out);
    stream.resume();
  }
}

module.exports = function (config) {
  pre.hasProperty(config, 'storageDir');

  files.mkdirsSync(config.storageDir);
  var uploadCount = 0;
  while (fs.existsSync(path.join(config.storageDir, String(uploadCount)))) {
    ++uploadCount;
  }

  return {
    store: function (data, cb) {
      var baseDir = path.resolve(path.join(config.storageDir, String(uploadCount++)));

      fs.mkdirSync(baseDir);
      async.parallel(
        [
          fileWriter(data.diasend, path.join(baseDir, 'diasend.xls')),
          fileWriter(data.carelink, path.join(baseDir, 'carelink.csv')),
          fileWriter(data.dexcom, path.join(baseDir, 'dexcom'))
        ],
        function(err, outFiles) {
          if (err != null) {
            cb(err);
          }
          cb(null, outFiles.filter(function(e){ return e != null; }));
        }
      );
    }
  };
};