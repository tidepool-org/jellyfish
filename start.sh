#! /bin/bash -eu

export SERVE_STATIC=dist

. config/env.sh
exec node app.js
