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
var url = require('url');

var amoeba = require('amoeba');
var async = require('async');
var except = amoeba.except;
var ingestion = require('in-d-gestion');
var pre = amoeba.pre;
var rx = require('rx');

var config = require('../env.js');
var log = require('../lib/log.js')('../lib/children/load.js');
console.log('');
console.log('Jellyfish test run. Caution: slippery when wet.');
console.log('');

var args = process.argv.slice(2);
// First command-line argument is the input raw Carelink CSV file
console.log('Reading from:',args[0]);
// Second command-line argument is the destination dir
console.log('Writing to:',args[1] + 'results.json');
var outputDir = null;
outputDir = args[1];
if (!fs.existsSync(outputDir)) {
    throw except.ISE('outputDir[%s] doesn\'t exist, please provide something that does', outputDir);
}
// Third command-line argument is an optional "storage location".  If this is set,
// then the script will write various programmatically readable things about how the
// task went, like if there is an error, it will dump an error object, etc.
console.log('Errors (if any) to:', args[2] + 'error.json');
console.log('');
var taskStorageDir = null;
taskStorageDir = args[2];
if (!fs.existsSync(taskStorageDir)) {
    throw except.ISE('taskStorageDir[%s] doesn\'t exist, please provide something that does', taskStorageDir);
}

var mongoClient = require('../lib/mongo/mongoClient.js')(config.mongo);
var testDAO = require('./testRunDAO.js')((require('../lib/streamDAO.js')(mongoClient)))
var streamDAO = require('../lib/jellyfishStreamDAO.js')(testDAO.DAO);
var storage = require('../lib/storage')(config.storage);



var input = null, config = {groupId: 'foo', username: 'bar'};
go(config);

function go(config) {
  async.waterfall(
    [
      mongoClient.start.bind(mongoClient)
    ],
    function (err, files) {
      if (err != null) {
        fail('Just another error', err);
      }

      files = [{ source: 'carelink', location: args[0],
        config:{
          type: 'carelink',
          file: args[0],
          encoding: '7bit',
          name: args[0],
          mimetype: 'text/plain',
          timezone: 'America/Los_Angeles' }
        }];

      var resultsArray = [];
      rx.Observable
        .fromArray(files)
        .flatMap(function (locSpec) {
                   var antacid = ingestion[locSpec.source];
                   if (antacid == null) {
                     throw except.ISE('Unknown data source[%s]', locSpec.source);
                   }
                   return antacid.parse(storage.get(locSpec.location), locSpec.config);
                 })
        .map(function (e) {
               e._groupId = config.groupId;
               return e;
             })
        .subscribe(
        function (e) {
          resultsArray.push(e);
        },
        function (err) {
          fail('Problem parsing data', err);
        },
        function () {
          if (resultsArray.length === 0) {
            fail('No results', new Error('No results'));
          }
          log.info('Persisting[%s] events to db.', resultsArray.length)
          streamDAO.storeData(resultsArray, function (err) {
            if (err != null) {
              fail('Problem with DB, Oh Noes!', err);
            }

            log.info('Persisted[%s] events to db.', resultsArray.length);
            mongoClient.close(function(err, results){
              fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify(testDAO.data)); 
              console.log('');
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