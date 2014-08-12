#! /bin/bash -eu

. config/env.sh
npm run build-config
exec node --trace_gc --max_new_space_size=16384 --max_old_space_size=128 app.js
