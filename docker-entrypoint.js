#!/usr/bin/env node
// See Dockerfile for context. `docker run --env-file .env` and Docker
// Compose's `env_file:` directive do a *literal* KEY=VALUE read of the file
// -- unlike `next dev`'s dotenv loading (or Prisma's `import "dotenv/config"`
// in prisma.config.ts), they do NOT strip surrounding quotes. This project's
// real `.env` file (written by the Prisma CLI / `vercel env pull`, e.g.
// `DATABASE_URL="postgresql://..."`) arrives inside the container with the
// literal `"` characters still attached to the value, which breaks the
// Postgres connection string parser (`pg`'s Pool sees a hostname starting
// with a stray quote and fails to connect). Found live while verifying the
// Dockerfile actually logs in against the real Neon DB, not just that
// `next build`/`docker build` succeed.
//
// Fix: strip one matching pair of leading/trailing single or double quotes
// off every environment variable before handing off to `next start`, so the
// exact same `.env` file that already works for local `next dev` also works
// unmodified under Docker.
// Plain CJS script run directly via `node docker-entrypoint.js` (no build
// step), so `require` (not `import`) is the correct/only option here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require("node:child_process");

for (const key of Object.keys(process.env)) {
  const value = process.env[key];
  if (
    value &&
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    process.env[key] = value.slice(1, -1);
  }
}

const child = spawn("npm", ["run", "start"], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start the app:", err);
  process.exit(1);
});
