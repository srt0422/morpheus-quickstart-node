const path = require('path');
require('dotenv').config();

// Get absolute paths
const userDir = path.join(__dirname);

module.exports = {
    uiPort: 1880,
    flowFile: 'flows.json',
    userDir: userDir,
    nodesDir: null,  // This will make Node-RED use node_modules by default
    functionGlobalContext: {
        env: process.env
    },
    debugMaxLength: 1000,
    logging: {
        console: {
            level: 'debug',
            metrics: false,
            audit: false
        }
    }
}; 