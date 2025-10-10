const express = require("express");
const cors = require("cors");
// const helmet = require('helmet'); // optional
// const compression = require('compression'); // optional
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/error");
const path = require("path");

const app = express();
app.disable("x-powered-by");
// app.use(helmet());
// app.use(compression());
app.use(express.json({ limit: "256kb" }));
app.use(cors());

// Local dev only: static frontend (disable on Render)
if (process.env.SERVE_STATIC === "1") {
  const distDir = path.resolve(__dirname, "../frontend/dist");
  app.use(express.static(distDir, { index: false }));
  app.get("/:path*", (_req, res) =>
    res.sendFile(path.join(distDir, "index.html"))
  );
}

// Mount API routes
app.use("/", routes);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

module.exports = app;
