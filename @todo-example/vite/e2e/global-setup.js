import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { createDaemon } from "springbokjs-daemon";
import { WEB_PORT, WS_PORT } from "./ports.ts";

export default async function globalSetup(config) {
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const cwdServer = fileURLToPath(new URL("../../server", import.meta.url));

  if (process.env.CI) {
    execSync("npx playwright install chromium --with-deps");
  }

  const viteBin = fileURLToPath(
    new URL("../../../node_modules/vite/bin/vite.js", import.meta.url),
  );

  const runVite = (args) =>
    spawnSync(process.execPath, [viteBin, ...args], {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        VITE_WS_URL: `ws://localhost:${WS_PORT}/ws`,
      },
    });

  runVite(["build", "--outDir", "dist/client"]);
  runVite([
    "build",
    "--ssr",
    "src/entry-server.tsx",
    "--outDir",
    "dist/server",
  ]);

  const mongodPromise = MongoMemoryServer.create();

  spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "../../../node_modules/rollup/dist/bin/rollup",
          import.meta.url,
        ),
      ),
      "--config",
      "rollup.config.mjs",
    ],
    {
      cwd: cwdServer,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    },
  );

  const mongod = await mongodPromise;

  const daemonWeb = createDaemon({
    displayName: "web",
    command: process.execPath,
    cwd,
    args: ["server.js"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(WEB_PORT),
    },
  });
  const daemonServer = createDaemon({
    displayName: "server",
    command: process.execPath,
    cwd: cwdServer,
    args: ["build/index-node.mjs"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(WS_PORT),
      MONGO_PORT: String(mongod.instanceInfo?.port),
    },
  });

  let stopped = false;
  const cleanup = async () => {
    if (stopped) return;
    stopped = true;
    // stop the daemons first (their child processes would otherwise be
    // orphaned), then the in-memory mongo.
    await Promise.allSettled([daemonWeb.stop(), daemonServer.stop()]);
    await mongod.stop();
  };

  // Best-effort cleanup if the process is interrupted. The `exit` event cannot
  // await async work, so it only triggers daemon kills synchronously; the
  // returned teardown below is the reliable path Playwright awaits.
  const onSignal = () => {
    // eslint-disable-next-line unicorn/no-process-exit
    cleanup().finally(() => process.exit(130));
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await Promise.all([daemonWeb.start(), daemonServer.start()]);

  // Returned function is awaited by Playwright as global teardown.
  return cleanup;
}
