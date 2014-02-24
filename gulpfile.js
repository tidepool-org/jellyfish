var gulp = require('gulp');
var browserify = require('gulp-browserify');
var less = require('gulp-less');
var concat = require('gulp-concat');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var cssmin = require('gulp-minify-css');
var clean = require('gulp-clean');
var runSequence = require('run-sequence');

var pkg = require('./package.json');
var files = require('./files');

gulp.task('scripts-browserify', function() {
  return gulp.src('client/main.js')
    .pipe(browserify({
      transform: ['reactify']
    }))
    .pipe(concat('main.js'))
    .pipe(gulp.dest('dist/tmp'));
});

gulp.task('scripts-config', function() {
  return gulp.src('client/config.js')
    .pipe(template({
      process: {env: process.env},
      pkg: pkg
    }))
    .pipe(gulp.dest('dist/tmp'));
});

gulp.task('scripts', ['scripts-browserify', 'scripts-config'], function() {
  var src = files.js.vendor;
  src.push('dist/tmp/config.js');
  src = src.concat([
    'dist/tmp/config.js',
    'dist/tmp/main.js'
  ]);

  return gulp.src(src)
    .pipe(concat('all.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist/build/' + pkg.version));
});

gulp.task('styles', function() {
  return gulp.src('client/style.less')
    .pipe(less())
    .pipe(concat('all.css'))
    .pipe(cssmin({keepSpecialComments: 0}))
    .pipe(gulp.dest('dist/build/' + pkg.version));
});

gulp.task('index', function() {
  return gulp.src('client/index.html')
    .pipe(template({
      production: true,
      pkg: pkg
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('fonts', function() {
  return gulp.src('client/fonts/**')
    .pipe(gulp.dest('dist/build/' + pkg.version + '/fonts'));
});

gulp.task('clean', function() {
  return gulp.src('dist', {read: false})
    .pipe(clean());
});

gulp.task('clean-tmp', function() {
  return gulp.src('dist/tmp', {read: false})
    .pipe(clean());
});

gulp.task('build', function(cb) {
  runSequence(
    'clean',
    ['scripts', 'styles', 'index', 'fonts'],
    'clean-tmp',
  cb);
});

gulp.task('default', ['build']);