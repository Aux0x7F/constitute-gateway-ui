import { SURFACE_APP, assertSurfaceAppContract } from "../../constitute-protocol/src/index.js";
import { defineSurfaceAppContract } from "../../constitute-ui/src/surface-app-contract.js";
import { createRuntimeSurfaceClient } from "../../constitute-ui/src/runtime-surface-client.js";
import {
  createSurfaceModuleRegistry,
  surfaceAppModuleImplementations,
} from "../../constitute-ui/src/surface-module-registry.js";
import {
  prepareRuntimeSnapshotModel,
  prepareSwarmEdgeStatus,
  runtimeStatusRows,
} from "./runtime-model.js";

const ISSUED_AT = 1700000000;

export const gatewaySurfaceAppContract = assertSurfaceAppContract({
  contractId: "surface-app:constitute-gateway-ui",
  schemaVersion: SURFACE_APP.SCHEMA_VERSION,
  appId: "constitute-gateway-ui",
  appRef: "app:gateway-ui",
  serviceRef: "service:gateway",
  surfaceRef: "surface:gateway-ui",
  version: "0.1.0",
  displayName: "Gateway",
  requiredPrimitives: [
    "runtime.attach",
    "swarm.directory",
    "projection.materialization",
  ],
  requiredModuleRoles: [
    SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  ],
  modules: [
    {
      moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
      role: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.1.0",
      primitiveRefs: ["runtime.attach", "runtime.intent"],
      inputs: ["runtime.snapshot"],
      outputs: ["runtime.intent"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-gateway-ui/runtime-model@0.1.0",
      role: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.1.0",
      primitiveRefs: ["projection.materialization", "swarm.directory"],
      inputs: ["runtime.snapshot"],
      outputs: ["gateway.read-model"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-gateway-ui/product-view@0.1.0",
      role: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.1.0",
      primitiveRefs: ["runtime.posture.render"],
      inputs: ["gateway.read-model"],
      outputs: ["user.intent"],
      issuedAt: ISSUED_AT,
    },
  ],
  projectionSubscriptions: [
    { projectionId: "swarm.directory", channelId: "swarm.directory" },
  ],
  updatePosture: {
    state: SURFACE_APP.UPDATE_POSTURE.STATIC,
    checkedAt: ISSUED_AT,
  },
  issuedAt: ISSUED_AT,
});

export const gatewaySurfaceApp = defineSurfaceAppContract(gatewaySurfaceAppContract, {
  validate: assertSurfaceAppContract,
});

export const gatewaySurfaceModuleRegistry = createSurfaceModuleRegistry([
  {
    moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
    role: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    version: "0.1.0",
    primitiveRefs: ["runtime.attach", "runtime.intent"],
    implementation: Object.freeze({ createRuntimeSurfaceClient }),
  },
  {
    moduleRef: "constitute-gateway-ui/runtime-model@0.1.0",
    role: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    version: "0.1.0",
    primitiveRefs: ["projection.materialization", "swarm.directory"],
    implementation: Object.freeze({
      prepareRuntimeSnapshotModel,
      prepareSwarmEdgeStatus,
      runtimeStatusRows,
    }),
  },
  {
    moduleRef: "constitute-gateway-ui/product-view@0.1.0",
    role: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
    version: "0.1.0",
    primitiveRefs: ["runtime.posture.render"],
    implementation: Object.freeze({ surfaceRef: "constitute-gateway-ui" }),
  },
]);

export const gatewaySurfaceModules = surfaceAppModuleImplementations(
  gatewaySurfaceModuleRegistry,
  gatewaySurfaceApp,
);

export const gatewayRuntimeClientModule = gatewaySurfaceModuleRegistry.require(
  gatewaySurfaceApp,
  SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
).implementation;

export const gatewayProjectionModelModule = gatewaySurfaceModuleRegistry.require(
  gatewaySurfaceApp,
  SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
).implementation;

export const gatewaySurfaceAttachContext = gatewaySurfaceApp.attachContext({
  productSurface: "constitute-gateway-ui",
});
