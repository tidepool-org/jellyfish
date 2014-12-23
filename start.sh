#! /bin/bash -eu

export SERVE_STATIC=dist

. config/env.sh
exec node --trace_gc --max_old_space_size=128 app.js
