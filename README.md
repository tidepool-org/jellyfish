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

## Configuration

Jellyfish is configured through environment variables. Besides the ports (`PORT` or `HTTPS_PORT` with
`HTTPS_CONFIG`), the MongoDB connection (`TIDEPOOL_STORE_*`) and the server credentials (`SERVER_NAME`,
`TIDEPOOL_SERVER_SECRET`), it needs the addresses of the platform services it calls, as `host:port`:

| Variable | Default | Service |
| --- | --- | --- |
| `TIDEPOOL_AUTH_CLIENT_ADDRESS` | `shoreline:9107` | user API (tokens) |
| `TIDEPOOL_PERMISSION_CLIENT_ADDRESS` | `gatekeeper:9123` | permissions |
| `TIDEPOOL_SEAGULL_CLIENT_ADDRESS` | `seagull:9120` | user metadata |
| `TIDEPOOL_DATA_CLIENT_ADDRESS` | `data:9220` | platform data service (upload postprocess work) |

`TIDEPOOL_DATA_CLIENT_ADDRESS` also accepts the `http://data:9220` form the platform services use.

### Upload postprocess work

After each upload request that stored data other than upload records, jellyfish asks the platform data
service to recalculate the summaries of the user and to synchronize the EHR by creating
`org.tidepool.data.upload.postprocess` work with `POST /v1/work`. Data present already counts as stored,
so re-uploading a device has the user postprocessed again; a request rejected before storing anything
creates no work.

Work creation is best-effort: the work is created after the upload is answered, and a failure is logged
at error level while the upload still succeeds, but the data uploaded is then not postprocessed until
the next upload of the user. On shutdown, jellyfish waits for the work requests still in flight, for up
to their timeout of 30 seconds, so the termination grace period of the pod has to cover that wait on top
of the `preStop` hook and the 5 seconds terminus waits before stopping the server.

**Deployment order.** The platform release providing `POST /v1/work` must be deployed before this
version of jellyfish, and this version of jellyfish must be deployed before the platform release that
retires the summary `outdatedSince` flag
([tidepool-org/platform#969](https://github.com/tidepool-org/platform/pull/969)): uploads through an
older jellyfish would otherwise mark summaries that nothing recalculates anymore.

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
