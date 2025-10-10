const http = require("http");
const app = require("./app");
const { env } = require("./config/env");

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server…");
  server.close(() => process.exit(0));
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});
