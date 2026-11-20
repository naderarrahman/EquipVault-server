const appModule = require('../dist/index.js');
const handler = appModule.default || appModule;

module.exports = handler;