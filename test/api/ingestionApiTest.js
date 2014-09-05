/*
 * == BSD2 LICENSE ==
 */

'use strict';

var fs = require('fs');

var async = require('async');

var _ = require('lodash');
var expect = require('salinity').expect;

var mongoClient = require('../../lib/mongo/mongoClient.js')(
  { connectionString: 'mongodb://localhost/test_ingestion', closeDelay: 0 }
);
var streamDAO = require('../../lib/streamDAO.js')(mongoClient);
var dataBroker = require('../../lib/dataBroker.js')(streamDAO);

var groupId = "1234";

describe('ingestion API', function () {
  before(function(done){
    mongoClient.start(done);
  });

  beforeEach(function (done) {
    mongoClient.withCollection('deviceData', done, function (coll, cb) {
      coll.remove(cb);
    });
  });

  var files = fs.readdirSync(__dirname);
  for (var i = 0; i < files.length; ++i) {
    var path = __dirname + '/' + files[i];
    if (fs.lstatSync(path).isDirectory()) {
      (function (dir) {
        var path = __dirname + '/' + dir;
        it(dir, function (done) {
          var input = JSON.parse(fs.readFileSync(path + '/input.json'));
          var output = JSON.parse(fs.readFileSync(path + '/output.json'));

          async.mapSeries(
            input,
            function(e, cb){
              e._groupId = groupId;
              dataBroker.addDatum(e, cb);
            },
            function(err){
              if (err != null) {
                return done(err);
              }

              mongoClient.withCollection('deviceData', done, function(coll, cb){
                coll.find().sort({"time": 1, "id": 1, "_version": 1}).toArray(function(err, results){
                  expect(results.map(function(e){ return _.omit(e, 'createdTime', 'modifiedTime', "_id", '_archivedTime') }))
                    .deep.equals(output.map(function(e){ e._groupId = groupId; return e; }));
                  cb(err);
                });
              });
            }
          );
        });
      })(files[i]);
    }
  }
});
