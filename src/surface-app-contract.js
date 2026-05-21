import {
  SURFACE_APP,
  SWARM,
  assertSurfaceAppManifest,
  assertSurfaceAppContract,
} from "constitute-protocol";
import {
  defineSurfaceAppContract,
} from "constitute-ui/surface-app-contract";
import { surfaceAppSelectionReadModel } from "constitute-ui/surface-selection-read-model";
import { createRuntimeSurfaceClient } from "constitute-ui/runtime-surface-client";
import {
  createSurfaceModuleRegistry,
} from "constitute-ui/surface-module-registry";
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
      materializationBudgetRefs: ["gateway-ui.runtime-snapshot"],
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
      materializationBudgetRefs: ["gateway-ui.runtime-snapshot", "gateway-ui.gateway-read-model"],
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
      materializationBudgetRefs: ["gateway-ui.gateway-read-model"],
      issuedAt: ISSUED_AT,
    },
  ],
  projectionSubscriptions: [
    { projectionId: "swarm.directory", channelId: "swarm.directory" },
  ],
  materializationBudgets: [
    {
      kind: SWARM.RECORD_KIND.MATERIALIZATION_BUDGET,
      budgetId: "gateway-ui.runtime-snapshot",
      sourceAuthority: "runtime.snapshot",
      consumerRef: "gateway-ui.runtime-model",
      payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.PROJECTION,
      copyRole: SWARM.MATERIALIZATION_COPY_ROLE.REFERENCE_ONLY,
      transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.REFERENCE_ONLY,
      privacyTier: SWARM.MATERIALIZATION_PRIVACY_TIER.SAFE_PROJECTION,
      state: SWARM.RESOURCE_POSTURE_STATE.WITHIN_BUDGET,
      limits: { maxProjectionCount: 3, maxRuntimeEvents: 64 },
      snapshotPolicy: { mode: "runtime-owned-baseline" },
      deltaPolicy: { mode: "snapshot-summary" },
      coalescing: { key: "runtimeSessionId" },
      cardinality: { maxRuntimeSessionIds: 1 },
      schema: { state: SWARM.MATERIALIZATION_SCHEMA_STATE.CURRENT, version: "gateway-ui.runtime-snapshot.v1" },
      referenceRefs: ["runtime.snapshot"],
      retentionClass: "ephemeral.ui-projection",
      issuedAt: ISSUED_AT,
    },
    {
      kind: SWARM.RECORD_KIND.MATERIALIZATION_BUDGET,
      budgetId: "gateway-ui.gateway-read-model",
      sourceAuthority: "swarm.directory",
      consumerRef: "gateway-ui.product-view",
      payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.PROJECTION,
      copyRole: SWARM.MATERIALIZATION_COPY_ROLE.PROJECTION,
      transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.CLONE,
      privacyTier: SWARM.MATERIALIZATION_PRIVACY_TIER.UI_PROJECTION,
      state: SWARM.RESOURCE_POSTURE_STATE.WITHIN_BUDGET,
      limits: { maxItems: 64, maxRenderedRows: 64 },
      snapshotPolicy: { mode: "service-registry-summary" },
      deltaPolicy: { mode: "coalesced-by-service" },
      coalescing: { key: "serviceRef" },
      cardinality: { maxServiceRefs: 32, maxGatewayRefs: 8 },
      schema: { state: SWARM.MATERIALIZATION_SCHEMA_STATE.CURRENT, version: "gateway-ui.read-model.v1" },
      referenceRefs: ["gateway.read-model"],
      retentionClass: "ephemeral.ui-projection",
      issuedAt: ISSUED_AT,
    },
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
    releaseRef: "release:gateway-ui:local",
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

export const gatewaySurfaceSelectionReadModel = surfaceAppSelectionReadModel({
  surfaceApp: gatewaySurfaceApp,
  manifest: gatewaySurfaceAppManifest,
  moduleRegistry: gatewaySurfaceModuleRegistry,
  moduleRoles: {
    runtimeClient: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    projectionModel: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    productView: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  },
  productSurface: "constitute-gateway-ui",
  runtimeVersion: "0.1.0",
  issuedAt: ISSUED_AT,
  serviceManagerOperationOptions: {
    operation: SURFACE_APP.SERVICE_MANAGER_OPERATION.HEALTH_CHECK,
    operationId: "operation:gateway-ui:bootstrap-health",
    requestedAt: ISSUED_AT,
  },
  serviceManagerProofDigestOptions: {
    digestId: "proof-digest:gateway-ui:bootstrap",
    observedAt: ISSUED_AT,
  },
});

export const gatewaySurfaceRuntimeSelectionPosture = gatewaySurfaceSelectionReadModel.runtimeSelectionPosture;
export const gatewaySurfaceModules = gatewaySurfaceSelectionReadModel.moduleBindings;
export const gatewaySurfaceRunnerPlan = gatewaySurfaceSelectionReadModel.runnerPlan;
export const gatewayServiceManagerSecretBoundary = gatewaySurfaceSelectionReadModel.serviceManagerSecretBoundary;
export const gatewaySurfaceBootstrapContract = gatewaySurfaceSelectionReadModel.bootstrapContract;
export const gatewaySurfaceBootstrapPosture = gatewaySurfaceSelectionReadModel.bootstrapPosture;
export const gatewayServiceManagerOperationPosture = gatewaySurfaceSelectionReadModel.serviceManagerOperationPosture;
export const gatewayServiceManagerProofDigest = gatewaySurfaceSelectionReadModel.serviceManagerProofDigest;
export const gatewaySurfaceAppInstancePosture = gatewaySurfaceSelectionReadModel.appInstancePosture;

export const gatewayRuntimeClientModule = gatewaySurfaceModules.byKey.runtimeClient.implementation;

export const gatewayProjectionModelModule = gatewaySurfaceModules.byKey.projectionModel.implementation;

export const gatewaySurfaceAttachContext = gatewaySurfaceSelectionReadModel.attachContext;
