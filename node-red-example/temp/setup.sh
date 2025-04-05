#!/bin/sh
set -e

cd /usr/src/node-red

# Install UniversalBuilder
cd /usr/src/node-red/lib/UniversalBuilder
npm install --no-package-lock
cd /usr/src/node-red
npm install ./lib/UniversalBuilder

# Start Node-RED with nodemon
npx nodemon --exec "node-red -u /data -s settings.js"
