import test from "node:test";
import assert from "node:assert/strict";
import {
  captureActiveFieldState,
  prepareRuntimeSnapshotModel,
  prepareSwarmEdgeStatus,
  restoreActiveFieldState,
  runtimeStatusRows,
} from "../src/runtime-model.js";

test("runtime model uses retained service catalog records", () => {
  const snapshot = {
    updatedAt: 1700000000000,
    managedAppliances: {
      owned: [{ role: "gateway", devicePk: "gateway-1", deviceLabel: "Lab Gateway" }],
      granted: [],
      discoverable: [],
    },
    serviceCatalog: {
      updatedAt: 1700000000100,
      services: [{
        service: "logging",
        servicePk: "logging-1",
        hostGatewayPk: "gateway-1",
        health: { status: "online", events: 42, producers: 2, storageStatus: "ok" },
        surface: { summary: "retained logging surface" },
      }],
    },
  };

  const prepared = prepareRuntimeSnapshotModel(snapshot);

  assert.equal(prepared.serviceCatalog.serviceCount, 1);
  assert.equal(prepared.records.some((record) => record.role === "gateway"), true);
  const logging = prepared.records.find((record) => record.service === "logging");
  assert.equal(logging.__source, "serviceCatalog");
  assert.equal(logging.status, "online");
  assert.equal(logging.facts.health.events, 42);
});

test("runtime model surfaces swarm edge queue reject and projection repair status", () => {
  const snapshot = {
    buildId: "runtime-test",
    updatedAt: Date.now(),
    projections: {
      "gateway.surface": { payload: {} },
    },
    projectionCoverage: {
      "gateway.surface": { syncState: "completeEnough" },
    },
    swarmQueue: {
      "frame-1": { frameId: "frame-1" },
      "frame-2": { frameId: "frame-2" },
    },
    edge: {
      mode: "fixture",
      connected: true,
      sentCount: 3,
      rejections: [{
        ts: 1700000000200,
        error: { code: "invalidAudience", message: "invalid audience" },
      }],
      repairRequests: [{
        ts: 1700000000300,
        projectionId: "gateway.surface",
        reason: "revisionGap",
      }],
    },
  };
  const edge = prepareSwarmEdgeStatus(snapshot);

  assert.equal(edge.connected, true);
  assert.equal(edge.queuedCount, 2);
  assert.equal(edge.ackLabel, "2 pending");
  assert.equal(edge.rejectCount, 1);
  assert.equal(edge.rejectLabel, "invalidAudience");
  assert.equal(edge.repairCount, 1);
  assert.equal(edge.repairLabel, "revisionGap");

  const prepared = prepareRuntimeSnapshotModel(snapshot);
  const rows = runtimeStatusRows(snapshot, prepared, prepared.records, "runtime-fallback");
  assert.deepEqual(rows.find((row) => row.label === "Swarm queue"), {
    label: "Swarm queue",
    value: "2 queued / 3 sent",
    tone: "warn",
  });
  assert.deepEqual(rows.find((row) => row.label === "Reject status"), {
    label: "Reject status",
    value: "1 invalidAudience",
    tone: "bad",
  });
  assert.deepEqual(rows.find((row) => row.label === "Projection repair"), {
    label: "Projection repair",
    value: "1 revisionGap",
    tone: "warn",
  });
  assert.equal(rows.find((row) => row.label === "Projection sync").value, "1 retained / completeEnough 1");
});

test("active field state can survive a projection snapshot render", () => {
  const before = {
    tagName: "INPUT",
    dataset: { preserveInputKey: "gateway-zone-sync:gateway-1" },
    value: "zone-a, zone-b",
    selectionStart: 8,
    selectionEnd: 14,
  };
  const after = {
    tagName: "INPUT",
    dataset: { preserveInputKey: "gateway-zone-sync:gateway-1" },
    value: "zone-a",
    focused: false,
    range: null,
    focus() {
      this.focused = true;
    },
    setSelectionRange(start, end) {
      this.range = [start, end];
    },
  };
  const doc = {
    activeElement: before,
    querySelectorAll(selector) {
      assert.equal(selector, "[data-preserve-input-key]");
      return [after];
    },
  };

  const captured = captureActiveFieldState(doc);
  assert.equal(captured.value, "zone-a, zone-b");
  assert.equal(restoreActiveFieldState(captured, doc), true);
  assert.equal(after.value, "zone-a, zone-b");
  assert.equal(after.focused, true);
  assert.deepEqual(after.range, [8, 14]);
});
