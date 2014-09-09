#! /bin/bash -eu

rm -rf node_modules
echo "starting npm install"
time npm install
echo "npm install completed"
./node_modules/.bin/mocha test
NODE_ENV=production npm run build-app
