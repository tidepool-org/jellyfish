# Jellyfish

Jellyfish are known for their user friendliness and uploads.

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

## Building the client

The client app is built as a static site in the `dist/` directory.

[Shio](https://github.com/tidepool-org/shio)'s `build.sh` script will take care of building the client app itself with:

```bash
$ npm run build-app
```

Shio's `start.sh` script then builds the config from environment variables as a separate file with:

```bash
$ npm run build-config
```

After that, the client app is ready to be served from the `dist/` directory by the production server:

```bash
$ SERVE_STATIC=dist npm start
```

You can also build everything at once locally by simply running:

```bash
$ npm run build
$ SERVE_STATIC=dist npm start
```

**NOTE**: `shelljs` used in the build scripts is known to sometimes cause an infinite loop using the synchronous version of `exec`. If a build script seems to take too long or hang, please kill the process and try again.
