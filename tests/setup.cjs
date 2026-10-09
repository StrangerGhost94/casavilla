// Lets server modules (which import "server-only") load under the Node test runner.
const Module = require("module");
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return load.call(this, request, ...rest);
};
