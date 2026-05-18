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
  assert.match(source, /from "\.\/surface-app-contract\.js"/);
  assert.match(source, /attachContext: gatewaySurfaceAttachContext/);
  assert.match(source, /PLATFORM_RUNTIME_BUILD_ID as RUNTIME_WORKER_BUILD_ID/);
  assert.match(source, /runtimeSharedWorkerName/);
  assert.match(source, /accountRuntimeWorkerScriptUrl\(window\.location\.origin\)/);
  assert.match(source, /gatewayRuntimeClientModule\.createRuntimeSurfaceClient/);
  assert.doesNotMatch(source, /runtime-surface-client\.js/);
  assert.doesNotMatch(source, /new SharedWorker/);
  assert.doesNotMatch(source, /pendingRuntimeResponses/);
  assert.doesNotMatch(source, /RUNTIME_WORKER_VERSION = Object\.freeze/);
});

test("gateway ui declares a surface app contract", async () => {
  const {
    gatewayRuntimeClientModule,
    gatewayServiceManagerOperationPosture,
    gatewayServiceManagerProofDigest,
    gatewayServiceManagerSecretBoundary,
    gatewaySurfaceApp,
    gatewaySurfaceAttachContext,
    gatewaySurfaceBootstrapContract,
    gatewaySurfaceBootstrapPosture,
    gatewaySurfaceModuleRegistry,
    gatewaySurfaceModules,
    gatewaySurfaceRunnerPlan,
  } = await import("../src/surface-app-contract.js");
  assert.equal(gatewaySurfaceApp.posture.state, "ready");
  assert.equal(gatewaySurfaceApp.hasRole("runtimeClient"), true);
  assert.equal(gatewaySurfaceApp.hasRole("projectionModel"), true);
  assert.equal(gatewaySurfaceApp.hasRole("productView"), true);
  assert.equal(gatewaySurfaceModuleRegistry.kind, "surface.module.registry");
  assert.equal(gatewaySurfaceModules.state, "ready");
  assert.equal(typeof gatewayRuntimeClientModule.createRuntimeSurfaceClient, "function");
  assert.equal(gatewaySurfaceAttachContext.kind, "surface.app.attachContext");
  assert.equal(gatewaySurfaceAttachContext.appId, "constitute-gateway-ui");
  assert.equal(gatewaySurfaceBootstrapPosture.state, "ready");
  assert.equal(gatewaySurfaceRunnerPlan.kind, "surface.app.runner.plan");
  assert.equal(gatewaySurfaceRunnerPlan.state, "ready");
  assert.equal(gatewaySurfaceBootstrapContract.kind, "surface.app.bootstrap.contract");
  assert.equal(gatewaySurfaceBootstrapContract.state, "ready");
  assert.equal(gatewayServiceManagerSecretBoundary.kind, "service.manager.secretBoundary");
  assert.equal(gatewayServiceManagerSecretBoundary.state, "notRequired");
  assert.equal(gatewayServiceManagerOperationPosture.kind, "service.manager.operation.posture");
  assert.equal(gatewayServiceManagerOperationPosture.state, "requested");
  assert.equal(gatewayServiceManagerProofDigest.kind, "service.manager.proof.digest");
  assert.equal(gatewaySurfaceAttachContext.runnerPlan, gatewaySurfaceRunnerPlan);
  assert.equal(gatewaySurfaceAttachContext.bootstrapContract, gatewaySurfaceBootstrapContract);
  assert.equal(gatewaySurfaceAttachContext.serviceManagerOperationPosture, gatewayServiceManagerOperationPosture);
});

test("gateway network panel consumes shared shell posture", () => {
  const source = readFileSync(resolve(here, "../src/main.js"), "utf8");
  assert.match(source, /function renderNetworkView\(records\)/);
  assert.match(source, /const shellState = deriveRuntimeShellState\(runtimeSnapshot, \{ context: browserStorageShellContext\(\) \}\)/);
  assert.match(source, /value: shellState\.connection\.label/);
  assert.match(source, /value: shellState\.services\.state/);
  assert.doesNotMatch(source, /const shellState = runtimeSnapshot\?\.shell \|\| \{\}/);
});
