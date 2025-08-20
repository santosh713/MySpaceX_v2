// server.js (entry for Vercel)
const app = require("./src/app");

// Export the Express app; @vercel/node will treat it as a handler (req, res)
module.exports = app;
