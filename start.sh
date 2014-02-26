#! /bin/bash -eu

. config/env.sh
exec node --trace_gc --max_new_space_size=16384 --max_old_space_size=48 app.js