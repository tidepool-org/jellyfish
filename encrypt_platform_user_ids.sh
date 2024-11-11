#!/bin/zsh

## e.g. qa3
ENV=$1
## e.g. qa3_ids.json
USER_IDS_FILE=$2
## e.g. "qa3 server secret"
SECRET_ITEM_NAME=$3

ENCRYPTED_USERIDS_FILE_PATH="./lib/schema/${ENV}_user_ids.json"
USER_IDS_JSON=($(jq -c '.' $USER_IDS_FILE))

SECRET=$(op item get $SECRET_ITEM_NAME --account tidepool.1password.com --fields label=credential --format json | jq -r '.value')

node -e "console.log(require('./lib/misc.js').encryptArrayToFile($USER_IDS_JSON,'$ENCRYPTED_USERIDS_FILE_PATH','$ENV', '$SECRET'))"
