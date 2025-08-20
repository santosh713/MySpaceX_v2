// src/app.js
const path = require("path");
const express = require("express");

const app = express();

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

// static files
app.use(express.static(path.join(process.cwd(), "public")));

// routes
const router = require("./routes");
app.use("/", router);

// ✅ export the actual Express app object
module.exports = app;
