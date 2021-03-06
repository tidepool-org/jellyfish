# Jellyfish

[![Build Status](https://travis-ci.com/tidepool-org/jellyfish.png)](https://travis-ci.com/tidepool-org/jellyfish)

Jellyfish are known for their user friendliness and uploads, sometimes.

## Install

Clone this repo then install dependencies:

```bash
$ npm install
```

## Quick start

Start the development server with:

```bash
$ npm start
```

## JSHint

Lint the files in this repo according to the local `.jshintrc` with:

```bash
$ npm run jshint
```

Or have the linter watch your files as you work with:

```bash
$ npm run jshint-watch
```

## Building the client

The client app is built as a static site in the `dist/` directory.


```bash
$ SERVE_STATIC=dist npm start
```

You can also build everything at once locally by simply running:

```bash
$ npm run build
$ SERVE_STATIC=dist npm start
```

**NOTE**: `shelljs` used in the build scripts is known to sometimes cause an infinite loop using the synchronous version of `exec`. If a build script seems to take too long or hang, please kill the process and try again.
