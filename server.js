"use strict";

process.env.NODE_ENV = "production";
process.env.HOSTNAME = "0.0.0.0";
process.env.HOST = "0.0.0.0";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = "0.0.0.0";

const app = next({ dev: false, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res, parse(req.url || "/", true));
    });
    server.on("error", (err) => {
      console.error("[stop3mr] listen error", err);
      process.exit(1);
    });
    server.listen(port, hostname, () => {
      console.log(`[stop3mr] listening on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("[stop3mr] prepare failed", err);
    process.exit(1);
  });
