import test from "node:test";
import assert from "node:assert/strict";

test("gateway ui manifest shape stays stable", async () => {
  const manifest = await import("../app.manifest.json", { with: { type: "json" } });
  assert.equal(manifest.default.id, "constitute-gateway-ui");
  assert.equal(manifest.default.entry, "dist/index.html");
});
