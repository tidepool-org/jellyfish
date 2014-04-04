/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var fs = require('fs');
var path = require('path');

var amoeba = require('amoeba');
var async = require('async');
var files = amoeba.files;
var moment = require('moment');
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
    get: function(location) {
      return fs.createReadStream(location);
    },
    save: function(userId, filename, data, cb) {
      var baseDir = path.resolve(path.join(config.storageDir, String(userId), moment.utc().format()));

      files.mkdirsSync(baseDir);
      fileWriter(data, path.join(baseDir, filename))(cb);
    }
  };
};