import {
  SURFACE_APP,
  assertServiceManagerSecretBoundary,
  assertSurfaceAppBootstrapContract,
  assertSurfaceAppManifest,
  assertSurfaceAppContract,
} from "../../constitute-protocol/src/index.js";
import {
  defineSurfaceAppContract,
  surfaceAppBootstrapPosture,
  surfaceAppInstancePosture,
  surfaceAppRuntimeSelectionPosture,
  surfaceAppRunnerPlan,
  surfaceServiceManagerOperationPosture,
  surfaceServiceManagerProofDigest,
} from "../../constitute-ui/src/surface-app-contract.js";
import { createRuntimeSurfaceClient } from "../../constitute-ui/src/runtime-surface-client.js";
import {
  createSurfaceModuleRegistry,
  surfaceAppModuleBindings,
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
  serviceManagerPosture: {
    managerId: "manager:manual:gateway-ui",
    subjectRef: "service:gateway",
    managerRef: "manager:manual:gateway-ui",
    state: SURFACE_APP.SERVICE_MANAGER_POSTURE.MANUAL,
    serviceRefs: ["service:gateway"],
    capabilityRefs: ["service.manage"],
    evidenceRefs: ["build:gateway-ui:local"],
    issuedAt: ISSUED_AT,
  },
  secretBoundary: {
    state: SURFACE_APP.SECRET_BOUNDARY.NOT_REQUIRED,
  },
  releasePosture: {
    state: SURFACE_APP.RELEASE_POSTURE.STATIC,
    evidenceRefs: ["build:gateway-ui:local"],
  },
  issuedAt: ISSUED_AT,
});

export const gatewaySurfaceApp = defineSurfaceAppContract(gatewaySurfaceAppContract, {
  validate: assertSurfaceAppContract,
});

export const gatewaySurfaceAppManifest = assertSurfaceAppManifest({
  kind: "surface.app.manifest",
  manifestId: "manifest:gateway-ui",
  appId: "constitute-gateway-ui",
  state: SURFACE_APP.MANIFEST_VERSION_STATE.CURRENT,
  currentAppContractRef: "app:gateway-ui",
  currentVersion: "0.1.0",
  defaultSourceMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
  requiredModuleRoles: [
    SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  ],
  bundledSourceRefs: ["bundle:gateway-ui@0.1.0"],
  compatibilityWindow: {
    minVersion: "0.1.0",
    maxVersion: "0.1.x",
    protocolRef: "protocol:surface-app:v1",
  },
  versions: [
    {
      appContractRef: "app:gateway-ui",
      version: "0.1.0",
      state: SURFACE_APP.MANIFEST_VERSION_STATE.CURRENT,
      sourceMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      requiredModuleRoles: [
        SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
        SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
        SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
      ],
      compatibilityWindow: {
        minVersion: "0.1.0",
        maxVersion: "0.1.x",
        protocolRef: "protocol:surface-app:v1",
      },
      bundledSourceRefs: ["bundle:gateway-ui@0.1.0"],
      grantRefs: ["grant:app:gateway-ui:run"],
      runnerRequirementRefs: ["runner:req:gateway-ui"],
      serviceManagerRequirementRefs: ["service-manager:req:gateway-ui"],
      compatibilityRefs: ["protocol:surface-app:v1"],
      bootstrapContractRef: "bootstrap-contract:app:gateway-ui",
      releaseContractRef: "release:gateway-ui:local",
      issuedAt: ISSUED_AT,
    },
  ],
  appContractRefs: ["app:gateway-ui"],
  grantRefs: ["grant:app:gateway-ui:run"],
  runnerRequirementRefs: ["runner:req:gateway-ui"],
  serviceManagerRequirementRefs: ["service-manager:req:gateway-ui"],
  compatibilityRefs: ["protocol:surface-app:v1"],
  bootstrapContractRefs: ["bootstrap-contract:app:gateway-ui"],
  releaseContractRefs: ["release:gateway-ui:local"],
  authorityRefs: ["authority:gateway-ui:local"],
  evidenceRefs: ["build:gateway-ui:local"],
  issuedAt: ISSUED_AT,
});

export const gatewaySurfaceRuntimeSelectionPosture = surfaceAppRuntimeSelectionPosture(
  gatewaySurfaceAppManifest,
  [gatewaySurfaceApp],
  {
    runtimeVersion: "0.1.0",
    issuedAt: ISSUED_AT,
  },
);

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

export const gatewaySurfaceModules = surfaceAppModuleBindings(
  gatewaySurfaceModuleRegistry,
  gatewaySurfaceRuntimeSelectionPosture,
  {
    runtimeClient: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    projectionModel: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    productView: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  },
);

export const gatewaySurfaceRunnerPlan = surfaceAppRunnerPlan(gatewaySurfaceApp, {
  issuedAt: ISSUED_AT,
});

export const gatewayServiceManagerSecretBoundary = assertServiceManagerSecretBoundary(
  gatewaySurfaceRunnerPlan.secretBoundary,
);

export const gatewaySurfaceBootstrapContract = assertSurfaceAppBootstrapContract(
  gatewaySurfaceRunnerPlan.bootstrapContract,
);

export const gatewaySurfaceBootstrapPosture = surfaceAppBootstrapPosture(gatewaySurfaceApp, {
  issuedAt: ISSUED_AT,
});

export const gatewayServiceManagerOperationPosture = surfaceServiceManagerOperationPosture(gatewaySurfaceApp, {
  operation: SURFACE_APP.SERVICE_MANAGER_OPERATION.HEALTH_CHECK,
  operationId: "operation:gateway-ui:bootstrap-health",
  requestedAt: ISSUED_AT,
});

export const gatewayServiceManagerProofDigest = surfaceServiceManagerProofDigest(gatewaySurfaceApp, {
  operationPosture: gatewayServiceManagerOperationPosture,
  digestId: "proof-digest:gateway-ui:bootstrap",
  observedAt: ISSUED_AT,
});

export const gatewaySurfaceAppInstancePosture = surfaceAppInstancePosture(gatewaySurfaceApp, {
  runtimeSelectionPosture: gatewaySurfaceRuntimeSelectionPosture,
  moduleBindings: gatewaySurfaceModules,
  runnerPlan: gatewaySurfaceRunnerPlan,
  bootstrapContract: gatewaySurfaceBootstrapContract,
  bootstrapPosture: gatewaySurfaceBootstrapPosture,
  serviceManagerOperationPosture: gatewayServiceManagerOperationPosture,
  serviceManagerProofDigest: gatewayServiceManagerProofDigest,
  issuedAt: ISSUED_AT,
});

export const gatewayRuntimeClientModule = gatewaySurfaceModules.byKey.runtimeClient.implementation;

export const gatewayProjectionModelModule = gatewaySurfaceModules.byKey.projectionModel.implementation;

export const gatewaySurfaceAttachContext = gatewaySurfaceApp.attachContext({
  productSurface: "constitute-gateway-ui",
  runtimeSelectionPosture: gatewaySurfaceRuntimeSelectionPosture,
  runnerPlan: gatewaySurfaceRunnerPlan,
  appInstancePosture: gatewaySurfaceAppInstancePosture,
  bootstrapContract: gatewaySurfaceBootstrapContract,
  serviceManagerSecretBoundary: gatewayServiceManagerSecretBoundary,
  bootstrapPosture: gatewaySurfaceBootstrapPosture,
  serviceManagerOperationPosture: gatewayServiceManagerOperationPosture,
  serviceManagerProofDigest: gatewayServiceManagerProofDigest,
});
