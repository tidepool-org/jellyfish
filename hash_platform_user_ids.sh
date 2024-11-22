#!/usr/bin/env sh -euo pipefail 

## e.g. qa3
ENV=$1
## e.g. "qa3 hash"
HASH_ITEM_NAME=$2

HASH=$(op item get "$HASH_ITEM_NAME" --account tidepool.1password.com --fields label=credential --format json | jq -r '.value')

node -e "console.log(require('./lib/misc.js').hashUserIds('$ENV', '$HASH'))"
