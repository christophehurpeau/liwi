/* oxlint-disable unicorn/no-await-expression-member */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProduction = process.env.NODE_ENV === "production";
const port = process.env.PORT || 3000;
const base = process.env.BASE || "/";

const app = express();

/** @type {import('vite').ViteDevServer | undefined} */
let vite;

if (isProduction) {
  const compression = (await import("compression")).default;
  const sirv = (await import("sirv")).default;
  app.use(compression());
  app.use(
    base,
    sirv(path.resolve(__dirname, "dist/client"), { extensions: [] }),
  );
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  });
  app.use(vite.middlewares);
}

const templateProd = isProduction
  ? await fs.readFile(path.resolve(__dirname, "dist/client/index.html"), "utf8")
  : "";

app.use(async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, "/");

    let template;
    /** @type {() => { html: string }} */
    let render;

    if (vite) {
      template = await fs.readFile(
        path.resolve(__dirname, "index.html"),
        "utf8",
      );
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render;
    } else {
      template = templateProd;
      // Built artifact only present after `vite build`; resolve at runtime so
      // import-x/no-unresolved doesn't fail when dist is absent (CI/dev).
      const entryServerPath = path.resolve(
        __dirname,
        "dist/server/entry-server.js",
      );
      render = (await import(entryServerPath)).render;
    }

    const { html } = render();
    const out = template.replace("<!--app-html-->", html);

    res.status(200).set({ "Content-Type": "text/html" }).end(out);
  } catch (error) {
    if (vite) vite.ssrFixStacktrace(error);
    console.error(error);
    res.status(500).end(error instanceof Error ? error.stack : String(error));
  }
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
  // Signal readiness to springbokjs-daemon (used by the e2e global setup) so it
  // resolves start() instead of waiting/timing out.
  process.send?.("ready");
});
