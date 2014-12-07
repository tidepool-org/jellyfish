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

'use strict';

/* global rm, mkdir, exec, ls*/
require('shelljs/global');
var fs = require('fs');
var ms = require('ms');

var start = new Date();

console.log('Building config...');
exec('webpack --entry \'./env.client.js\' --output-library \'config\' --output-file \'config.[hash].js\' --colors --progress');

function getBundleFilename() {
  var matches = ls('dist/config.*.js');
  if (!(matches && matches.length)) {
    throw new Error('Expected to find "dist/config.[hash].js"');
  }
  return matches[0].replace('dist/', '');
}

console.log('Updating "dist/index.html"...');
var indexHtml = fs.readFileSync('dist/index.html', 'utf8');
indexHtml = indexHtml.replace('<!-- config -->',
  '<script type="text/javascript" src="' + getBundleFilename() + '"></script>'
);
indexHtml.to('dist/index.html');

var end = new Date();
console.log('Config built in ' + ms(end - start));
