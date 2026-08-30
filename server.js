"use strict";

process.env.NODE_ENV = "production";

const { spawn } = require("child_process");
const path = require("path");

const port = process.env.PORT || "3000";
// Never use Linux HOSTNAME (machine name) — binding to it fails and Hostinger returns 503.
const host = process.env.HOST || "0.0.0.0";
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "start", "-H", host, "-p", String(port)], {
  stdio: "inherit",
  cwd: __dirname,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
