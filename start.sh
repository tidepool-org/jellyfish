#! /bin/bash -eu

export SERVE_STATIC=dist 

. config/env.sh
npm run build-config
exec node --trace_gc --max_old_space_size=128 app.js
