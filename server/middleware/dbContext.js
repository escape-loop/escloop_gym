const { AsyncLocalStorage } = require('async_hooks');
const dbStorage = new AsyncLocalStorage();
module.exports = dbStorage;
