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
  assert.match(source, /from "\.\.\/\.\.\/constitute-account\/runtime-contract\.js"/);
  assert.match(source, /PLATFORM_RUNTIME_BUILD_ID as RUNTIME_WORKER_BUILD_ID/);
  assert.match(source, /runtimeSharedWorkerName/);
  assert.match(source, /accountRuntimeWorkerScriptUrl\(window\.location\.origin\)/);
  assert.match(source, /createRuntimeSurfaceClient/);
  assert.doesNotMatch(source, /new SharedWorker/);
  assert.doesNotMatch(source, /pendingRuntimeResponses/);
  assert.doesNotMatch(source, /RUNTIME_WORKER_VERSION = Object\.freeze/);
});

test("gateway network panel consumes shared shell posture", () => {
  const source = readFileSync(resolve(here, "../src/main.js"), "utf8");
  assert.match(source, /function renderNetworkView\(records\)/);
  assert.match(source, /const shellState = deriveRuntimeShellState\(runtimeSnapshot, \{ context: browserStorageShellContext\(\) \}\)/);
  assert.match(source, /value: shellState\.connection\.label/);
  assert.match(source, /value: shellState\.services\.state/);
  assert.doesNotMatch(source, /const shellState = runtimeSnapshot\?\.shell \|\| \{\}/);
});
