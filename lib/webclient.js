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

var path = require('path');

var express = require('express');
var es = require('event-stream');
var gulp = require('gulp');
var browserify = require('gulp-browserify');
var less = require('gulp-less');
var concat = require('gulp-concat');
var template = require('gulp-template');

var ROOT = __dirname;

var pkg = require('../package.json');
var files = require('../files.js');

function setupForDevelopment(app) {

  app.get('/main.js', function(req, res, next) {
    res.setHeader('Content-Type', 'text/javascript');

    gulp.src(path.join(ROOT, '../client/main.js'))
      .pipe(browserify({
        transform: ['reactify'],
        debug: true
      }))
      // Error handling: can't just pass `next`,
      // need to explicitly give it a function
      .on('error', function(err) {
        next(err);
      })
      .pipe(concat('main.js'))
      .pipe(send(res));
  });

  app.get('/config.js', function(req, res) {
    res.setHeader('Content-Type', 'text/javascript');

    gulp.src(path.join(ROOT, '../client/config.js'))
      .pipe(template({
        process: {env: process.env},
        pkg: pkg
      }))
      .on('error', function(err) {
        next(err);
      })
      .pipe(send(res));
  });

  app.use('/bower_components',
          express.static(path.join(ROOT, '../bower_components')));

  app.get('/style.css', function(req, res, next) {
    res.setHeader('Content-Type', 'text/css');

    gulp.src(path.join(ROOT, '../client/style.less'))
      .pipe(less())
      .on('error', function(err) {
        next(err);
      })
      .pipe(concat('style.css'))
      .pipe(send(res));
  });

  app.use('/fonts', express.static(path.join(ROOT, '../client/fonts')));

  app.get('/', function(req, res, next) {
    res.setHeader('Content-Type', 'text/html');

    gulp.src(path.join(ROOT, '../client/index.html'))
      .pipe(template({
        production: false,
        pkg: pkg,
        files: files
      }))
      .on('error', function(err) {
        next(err);
      })
      .pipe(send(res));
  });

  return app;
}

function setupForProduction(app) {
  app.use(express.static(path.join(ROOT, '../dist')));
}

// Glup plugin to send first file to HTTP client
// Inspired by:
// https://github.com/wearefractal/gulp/blob/master/lib/createOutputStream/writeFile.js
function send(res) {
  var fileSent = false;

  function sendFile(file, cb) {
    if (!fileSent) {
      
      if (file.isStream()) {
        file.contents.once('end', function(){
          cb(null, file);
        });
        file.contents.pipe(res);
        fileSent = true;
        return;
      }

      if (file.isBuffer()) {
        res.end(file.contents);
        cb(null, file);
        fileSent = true;
        return;
      }

      res.end();
      cb(null, file);
      fileSent = true;
      return;
    }

    cb(null, file);
  }

  return es.map(sendFile);
};

module.exports = {
  setupForDevelopment: setupForDevelopment,
  setupForProduction: setupForProduction
}