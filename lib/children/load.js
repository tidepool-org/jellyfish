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

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var url = require('url');

var amoeba = require('amoeba');
var async = require('async');
var base32hex = amoeba.base32hex;
var except = amoeba.except;
var ingestion = require('in-d-gestion');
var pre = amoeba.pre;
var rx = require('rx');

var config = require('../../env.js');
var log = require('../log.js')('children/load.js');


// First command-line argument is an optional "storage location".  If this is set,
// then the script will write various programmatically readable things about how the
// task went, like if there is an error, it will dump an error object, etc.
var taskStorageDir = null;
if (process.argv.length >= 3) {
  taskStorageDir = process.argv[2];
  if (!fs.existsSync(taskStorageDir)) {
    throw except.ISE('taskStorageDir[%s] doesn\'t exist, please provide something that does', taskStorageDir);
  }
}

var mongoClient = require('../mongo/mongoClient.js')(config.mongo);
var dataBroker = require('../dataBroker.js')(mongoClient);
var storage = require('../storage')(config.storage);

var input = '';
process.stdin.on('data', function (chunk) {
  input += chunk.toString();
  if (input.lastIndexOf('}') === input.length - 1) {
    var config = JSON.parse(input);
    input = null;

    pre.hasProperty(config, 'groupId');

    process.nextTick(function () {
      go(config);
    });
  }
});

function go(config) {
  async.waterfall(
    [
      mongoClient.start.bind(mongoClient),
      function (cb) {
        download(config, cb);
      },
      function (locations, cb) {
        removeData(config.groupId, function (err) {
          cb(err, locations);
        });
      }
    ],
    function (err, files) {
      if (err != null) {
        fail('Just another error', err);
      }

      var eventCount = 0;
      var resultsArray = [];
      var persistCount = 0;
      rx.Observable
        .fromArray(files)
        .flatMap(function (locSpec) {
                   var antacid = ingestion[locSpec.source];
                   if (antacid == null) {
                     throw except.ISE('Unknown data source[%s]', locSpec.source);
                   }
                   return antacid.parse(storage.get(locSpec.location));
                 })
        .map(function (e) {
               e.groupId = config.groupId;

               var hasher = crypto.createHash('sha1');
               if (e._id == null) {
                 if (e.id == null) {
                   hasher.update(e.type);
                   hasher.update(String(e.value));
                   hasher.update(e.deviceTime);
                   e.id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
                   hasher = crypto.createHash('sha1');
                 }
                 hasher.update(e.id);
                 hasher.update(e.groupId);
                 e._id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
               }

               return e;
             })
        .subscribe(
        function (e) {
          ++eventCount;
          resultsArray.push(e);
          if (resultsArray.length >= 1000) {
            dataBroker.storeData(resultsArray, function (err) {
              if (err != null) {
                if (err.code === 11000) {
                  log.info('Got a duplicate id, but continuing anyway.', err.err);
                } else {
                  fail('Problem with DB', err);
                }
              }
            });
            resultsArray = [];
          }
        },
        function (err) {
          fail('Problem parsing data', err);
        },
        function () {
          dataBroker.storeData(resultsArray, function (err) {
            if (err != null) {
              if (err.code === 11000) {
                log.info('Got a duplicate id, but continuing anyway.', err.err);
              } else {
                fail('Problem with DB, Oh Noes!', err);
              }
            }
            log.info('Persisted[%s] events to db.', eventCount);
            mongoClient.close(function(err, results){
              process.exit(0);
            });
          });
        });
    }
  )
}

function fail(reason, error) {
  mongoClient.close();
  log.warn(error, 'Failing due to error, with reason[%s].', reason);
  if (taskStorageDir != null) {
    fs.writeFileSync(path.join(taskStorageDir, 'error.json'), JSON.stringify({ reason: reason }));
  }
  process.exit(255);
}

function fetch(groupId, filename, config, cb) {
  if (config == null) {
    process.nextTick(cb);
  } else {
    var type = config.type;
    var antacid = ingestion[type];
    if (antacid == null) {
      throw except.ISE('Unknown service[%s] to fetch from.', type);
    }

    log.info('Fetching %s data for user[%s]', type, config.username);
    var startTime = new Date().valueOf();
    var bytesPulled = 0;
    antacid.fetch(config, function (err, dataStream) {
      if (err != null) {
        fail('Couldn\'t fetch!?', err);
        return;
      }

      dataStream.on('data', function (chunk) {
        if (bytesPulled == 0) {
          log.info('First byte pulled in [%s] millis.', new Date().valueOf() - startTime);
        }
        bytesPulled += chunk.length;
      });
      dataStream.on('end', function () {
        log.info('%s data pulled in [%s] millis.  Size [%s]', type, new Date().valueOf() - startTime, bytesPulled);
      });

      storage.save(groupId, filename, dataStream, cb);
    });
  }
}

function download(config, callback) {
  // The enumeration o the upload options and the repetition in the following lines is ugly,
  // but we have to do it this way until we have thing setup such that we don't have to
  // delete all of the previously existing data in order to load more data.  At that point in
  // time, each file can be its own stream of processing and life will hopefully be nicer.
  async.parallel(
    [
      function (cb) {
        fetch(config.groupId, 'carelink.csv', config.carelink, function (err, loc) {
          cb(err, loc == null ? loc : { source: 'carelink', location: loc });
        });
      },
      function (cb) {
        fetch(config.groupId, 'diasend.xls', config.diasend, function (err, loc) {
          cb(err, loc == null ? loc : { source: 'diasend', location: loc });
        });
      },
      function (cb) {
        if (config.dexcom == null) {
          process.nextTick(cb);
        } else {
          fetch(config.groupId, 'dexcom.csv', config.dexcom, function (err, location) {
            fs.unlink(config.dexcom.file, function (error) {
              if (error != null) {
                log.warn(error, 'error deleting file[%s]', config.dexcom.file);
              }
              cb(err, { source: 'dexcom', location: location });
            });
          });
        }
      }
    ],
    function (error, locations) {
      if (error != null) {
        return fail(error.message, error);
      }

      callback(null, locations.filter(function (e) { return e != null; }));
    }
  )
}

function removeData(groupId, cb) {
  log.info('Deleting all data for group[%s]', groupId);
  dataBroker.deleteData(groupId, cb);
}