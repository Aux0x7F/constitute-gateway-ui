import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

test("gateway ui manifest shape stays stable", async () => {
  const manifest = await import("../app.manifest.json", { with: { type: "json" } });
  assert.equal(manifest.default.id, "constitute-gateway-ui");
  assert.equal(manifest.default.entry, "dist/index.html");
});

test("gateway ui uses the current shared runtime worker build", () => {
  const source = readFileSync(resolve(here, "../src/main.js"), "utf8");
  assert.match(source, /const RUNTIME_WORKER_VERSION = Object\.freeze\(\{ major: 2, minor: 12 \}\)/);
  assert.match(source, /name: `constitute-account-runtime-\$\{RUNTIME_WORKER_BUILD_ID\}`/);
});
