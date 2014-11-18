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

var path = require('path');
var fs = require('fs');

var _ = require('lodash');
var webpackDevMiddleware = require('webpack-dev-middleware');
var webpack = require('webpack');
var express = require('express');

var ROOT = __dirname;
var DEFAULT_STATIC_DIR = 'dist';

var webpackConfig = require('../webpack.config.js');
webpackConfig = _.assign(webpackConfig, {
  cache: true,
  devtool: 'eval-source-map'
});


function setupForDevelopment(app) {
  var webpackCompiler = webpack(webpackConfig);
  app.use(webpackDevMiddleware(webpackCompiler));

  app.get('/', function(req, res, next) {
    res.setHeader('Content-Type', 'text/html');

    fs.createReadStream(path.join(ROOT, '../client/index.html')).pipe(res);
  });

  return app;
}

function setupForProduction(app, staticDir) {
  if (staticDir == null) {
    staticDir = DEFAULT_STATIC_DIR;
  }
  app.use(express.static(path.join(ROOT, '..', staticDir)));

  return app;
}

module.exports = {
  setupForDevelopment: setupForDevelopment,
  setupForProduction: setupForProduction
};
