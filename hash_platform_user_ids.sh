#!/usr/bin/env sh -euo pipefail 

## e.g. qa3
ENV=$1
USER_IDS_FILE=$2
## e.g. "qa3 hash"
SALT_ITEM_NAME=$3

SALT=$(op item get "$SALT_ITEM_NAME" --account tidepool.1password.com --fields label=credential --format json | jq -r '.value')

USER_IDS=$(jq -r '.[]' "$USER_IDS_FILE")

node -e "console.log(require('./lib/misc.js').addUserIdsToHashedEnvironmentFile('$ENV', '$SALT', '$USER_IDS'))"
