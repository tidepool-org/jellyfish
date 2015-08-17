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

/*
 * A stupid utility to insert a file json events into mongo.
 * arguments are <groupId> <mongoConnectString> <fileWithJsonObjects>
 */

'use strict';

var crypto = require('crypto');
var fs = require('fs');

var base32hex = require('amoeba').base32hex;

var groupId = process.argv[2];
var mongoConnectString = process.argv[3];
var file = process.argv[4];

var contents = fs.readFileSync(file, {encoding: 'utf8'});

if (contents[0] === '{') {
  // It's objects, convert to an array
  contents = '[' + contents.replace(new RegExp('\n', 'g'), ',');
  if (contents[contents.length - 1] === ',') {
    contents = contents.substr(0, contents.length - 1);
  }
  contents = contents + ']';
}

contents = JSON.parse(contents);

var mongoClient = require('../lib/mongo/mongoClient.js')({ connectionString: mongoConnectString });
var streamDAO = require('../lib/streamDAO.js')(mongoClient);

mongoClient.start(function(err){
  if (err != null) {
    console.log(err.stack);
    process.exit(1);
  }

  contents.forEach(function(e){
    e.groupId = groupId;

    var hasher = crypto.createHash('sha1');
    hasher.update(e.id);
    hasher.update(e.groupId);
    e._id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
  });

  streamDAO.storeData(contents, function(err) {
    if (err != null) {
      if (err.code === 11000) {
        console.log('Got a duplicate id, but continuing anyway.', err.err);
      } else {
        console.log(err.stack);
        process.exit(1);
      }
    }

    mongoClient.close();
  });
});
