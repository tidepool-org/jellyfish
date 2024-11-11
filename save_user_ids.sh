#!/bin/zsh

## e.g. qa3
ENV=$1
## e.g. qa3_ids.txt
USER_IDS_FILE=$2
## e.g. "qa3 server secret"
SECRET_ITEM_NAME=$3
ENCRYPTED_USERIDS_FILE_PATH="./lib/schema/${ENV}_user_ids.json"

USER_IDS=()

while IFS= read -r line; do
    USER_IDS+=("$line")
done <$USER_IDS_FILE

user_ids_json="[\"$(printf '%s", "' "${USER_IDS[@]}" | sed 's/, $//')\"]"

SECRET=$(op item get $SECRET_ITEM_NAME --account tidepool.1password.com --fields label=credential --format json | jq -r '.value')

node -e "console.log(require('./lib/misc.js').encryptArrayToFile($user_ids_json,'$ENCRYPTED_USERIDS_FILE_PATH','$ENV', '$SECRET'))"
