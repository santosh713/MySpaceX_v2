// src/server.js
let app = require("./app");
app = app && app.default ? app.default : app; // handle default export

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MySpaceX running at http://localhost:${PORT}`);
});
