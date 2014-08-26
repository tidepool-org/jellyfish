#! /bin/bash -eu

rm -rf node_modules
echo "starting npm install"
time npm install --production
echo "npm install completed"
NODE_ENV=production npm run build-app
