const serverless = require("serverless-http");
const app = require("../src/app");

module.exports = (req, res) => {
  return serverless(app)(req, res);
};
