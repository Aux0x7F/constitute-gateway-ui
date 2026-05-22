import {
  deriveRuntimeMaterializationPosture,
  preparedServiceRegistry,
  projectionPostureSummary,
} from "constitute-ui";

function normalizedArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeJson(raw) {
  try {
    return JSON.parse(String(raw || ""));
  } catch {
    return null;
  }
}

function storageValue(storage, key) {
  try {
    return storage && typeof storage.getItem === "function" ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageRecords(storage, key) {
  const value = safeJson(storageValue(storage, key));
  const records = value && typeof value === "object" && !Array.isArray(value)
    ? value.records
    : value;
  return normalizedArray(records).filter((entry) => entry && typeof entry === "object");
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function postureState(value, fallback = "unknown") {
  return String(normalizeObject(value).state || fallback).trim() || fallback;
}

function postureReason(value) {
  const posture = normalizeObject(value);
  return String(posture.cleanupReason || posture.reason || posture.blockedReason || "").trim();
}

function hostFabricPosture(value) {
  const fabric = normalizeObject(value);
  if (!Object.keys(fabric).length) {
    return { state: "missing", blockedReasons: [], label: "missing" };
  }
  const state = String(fabric.state || fabric.fulfillmentPlan?.state || fabric.lifecyclePlan?.state || "unknown").trim() || "unknown";
  const blockedReasons = normalizedArray(fabric.blockedReasons).map((reason) => String(reason || "").trim()).filter(Boolean);
  const handoffRef = String(fabric.associationHandoffRef || "").trim();
  return {
    state,
    blockedReasons,
    handoffRef,
    label: [
      state,
      blockedReasons.length ? `blocked ${blockedReasons.slice(0, 2).join(", ")}` : "",
      handoffRef ? `handoff ${shortRef(handoffRef)}` : "",
    ].filter(Boolean).join(" / "),
  };
}

function shortRef(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 18) return raw;
  return `${raw.slice(0, 10)}...${raw.slice(-5)}`;
}

function serviceRecordKey(record) {
  const service = normalizeRole(record?.service || record?.slug || record?.name || "");
  const servicePk = String(record?.devicePk || record?.pk || record?.servicePk || record?.service_pk || "").trim();
  const hostGatewayPk = String(record?.hostGatewayPk || record?.host_gateway_pk || "").trim();
  if (service) return ["service", hostGatewayPk, service, servicePk || service].join(":");
  const gatewayPk = String(record?.devicePk || record?.pk || "").trim();
  return ["gateway", record?.__scope || "runtime", gatewayPk || String(record?.label || "")].join(":");
}

function normalizeManagedRecords(snapshot) {
  const managed = normalizeObject(snapshot?.managedAppliances);
  const buckets = [
    { scope: "owned", items: normalizedArray(managed?.owned) },
    { scope: "shared", items: normalizedArray(managed?.granted) },
    { scope: "discoverable", items: normalizedArray(managed?.discoverable) },
  ];
  const out = [];
  for (const bucket of buckets) {
    for (const raw of bucket.items) {
      if (!raw || typeof raw !== "object") continue;
      out.push({
        ...raw,
        __scope: bucket.scope,
        __source: "runtimeBaseline",
      });
    }
  }
  return out;
}

function hostedRecordsFromSourceRecords(records) {
  const out = [];
  for (const source of normalizedArray(records)) {
    const gatewayPk = String(source?.devicePk || source?.pk || source?.gatewayPk || "").trim();
    const hosted = normalizedArray(source?.hostedServices || source?.hosted_services);
    for (const service of hosted) {
      if (!service || typeof service !== "object") continue;
      const servicePk = String(service.devicePk || service.device_pk || service.servicePk || service.service_pk || service.pk || "").trim();
      if (!servicePk) continue;
      out.push({
        ...service,
        devicePk: servicePk,
        servicePk,
        pk: servicePk,
        hostGatewayPk: String(service.hostGatewayPk || service.host_gateway_pk || gatewayPk).trim(),
        service: String(service.service || service.slug || service.name || "").trim(),
        role: String(service.role || service.service || service.slug || service.name || "").trim(),
        deviceKind: String(service.deviceKind || service.device_kind || "service").trim() || "service",
        facts: normalizeObject(service.facts),
        __scope: "local",
        __source: "browserStorageCache",
      });
    }
  }
  return out;
}

function browserStorageManagedRecords(storage) {
  const deviceRecords = storageRecords(storage, "swarm.deviceCache").map((entry) => ({
    ...entry,
    __scope: "local",
    __source: "browserStorageCache",
  }));
  const hostedSnapshotRecords = [];
  const gatewaySnapshots = safeJson(storageValue(storage, "constitute.gatewayHostedSnapshots"));
  if (gatewaySnapshots && typeof gatewaySnapshots === "object" && !Array.isArray(gatewaySnapshots)) {
    for (const [gatewayPk, snapshot] of Object.entries(gatewaySnapshots)) {
      const record = normalizeObject(snapshot);
      hostedSnapshotRecords.push({
        ...record,
        devicePk: String(record.devicePk || record.gatewayPk || gatewayPk).trim(),
        pk: String(record.devicePk || record.gatewayPk || gatewayPk).trim(),
        role: "gateway",
        service: "gateway",
        deviceKind: "gateway",
        __scope: "local",
        __source: "browserStorageCache",
      });
    }
  }
  return [
    ...deviceRecords,
    ...hostedRecordsFromSourceRecords(deviceRecords),
    ...hostedRecordsFromSourceRecords(hostedSnapshotRecords),
  ];
}

function serviceCatalogRecords(snapshot) {
  const registry = preparedServiceRegistry(snapshot || {});
  const updatedAt = Number(registry.updatedAt || snapshot?.updatedAt || 0);
  return normalizedArray(registry.services).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const service = normalizeRole(entry.service || "");
    const servicePk = String(entry.servicePk || entry.service_pk || "").trim();
    if (!service || !servicePk) return [];
    const health = normalizeObject(entry.health || entry.surface?.health);
    const label = String(entry.label || entry.displayName || entry.surface?.displayName || "").trim();
    return [{
      ...entry,
      service,
      devicePk: servicePk,
      servicePk,
      hostGatewayPk: String(entry.hostGatewayPk || entry.host_gateway_pk || "").trim(),
      label: label || service,
      status: String(health.status || entry.status || "").trim(),
      hostFabric: hostFabricPosture(entry.hostFabric),
      facts: {
        ...(normalizeObject(entry.facts)),
        health,
      },
      managedAvailabilityUpdatedAt: updatedAt,
      __scope: "runtime",
      __source: registry.source,
      __registryState: registry.state,
    }];
  });
}

function mergeRecord(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && !value.trim()) return false;
      return true;
    })),
    facts: {
      ...normalizeObject(existing.facts),
      ...normalizeObject(incoming.facts),
      health: {
        ...normalizeObject(existing.facts?.health),
        ...normalizeObject(incoming.facts?.health),
      },
    },
    __scope: incoming.__scope || existing.__scope,
    __source: incoming.__source || existing.__source,
  };
}

export function normalizeRuntimeRecords(snapshot, options = {}) {
  const byKey = new Map();
  for (const record of normalizeManagedRecords(snapshot)) {
    const key = serviceRecordKey(record);
    if (!key) continue;
    byKey.set(key, mergeRecord(byKey.get(key), record));
  }
  for (const record of browserStorageManagedRecords(options.browserStorage)) {
    const key = serviceRecordKey(record);
    if (!key) continue;
    byKey.set(key, mergeRecord(byKey.get(key), record));
  }
  for (const record of serviceCatalogRecords(snapshot)) {
    const key = serviceRecordKey(record);
    if (!key) continue;
    byKey.set(key, mergeRecord(byKey.get(key), record));
  }
  return Array.from(byKey.values());
}

function latestEntry(entries) {
  return normalizedArray(entries)
    .slice()
    .sort((a, b) => Number(b?.ts || b?.issuedAt || b?.createdAt || 0) - Number(a?.ts || a?.issuedAt || a?.createdAt || 0))[0] || null;
}

export function prepareSwarmEdgeStatus(snapshot) {
  const edge = normalizeObject(snapshot?.edge);
  const swarmQueue = normalizeObject(snapshot?.swarmQueue);
  const queuedCount = Number.isFinite(Number(edge.queuedCount))
    ? Number(edge.queuedCount)
    : Object.keys(swarmQueue).length;
  const sentCount = Number(edge.sentCount || 0);
  const rejections = normalizedArray(edge.rejections);
  const repairs = normalizedArray(edge.repairRequests);
  const latestReject = latestEntry(rejections);
  const latestRepair = latestEntry(repairs);
  return {
    mode: String(edge.mode || "unknown"),
    connected: edge.connected === true,
    queuedCount,
    sentCount,
    ackLabel: queuedCount === 0 ? "clear" : `${queuedCount} pending`,
    rejectCount: rejections.length,
    rejectLabel: latestReject
      ? String(latestReject.error?.code || latestReject.reason || latestReject.reasonCode || "rejected")
      : "none",
    repairCount: repairs.length,
    repairLabel: latestRepair
      ? String(latestRepair.reason || latestRepair.projectionId || latestRepair.projectionKey || "requested")
      : "none",
    latestReject,
    latestRepair,
  };
}

export function prepareProjectionStatus(snapshot) {
  return projectionPostureSummary(snapshot || {});
}

export function prepareRuntimeSnapshotModel(snapshot, options = {}) {
  const records = normalizeRuntimeRecords(snapshot, options);
  const registry = preparedServiceRegistry(snapshot || {});
  const serviceRecords = records.filter((record) => normalizeRole(record.service));
  const fabricReadyCount = serviceRecords.filter((record) => normalizeObject(record.hostFabric).state === "ready").length;
  const fabricBlockedCount = serviceRecords.filter((record) => normalizedArray(normalizeObject(record.hostFabric).blockedReasons).length > 0).length;
  const materialization = deriveRuntimeMaterializationPosture(snapshot || {}, {
    materializationBudget: options.materializationBudget,
    consumerFloor: options.consumerFloor,
  });
  return {
    records,
    serviceCatalog: {
      updatedAt: Number(registry.updatedAt || 0),
      serviceCount: registry.serviceCount,
      source: registry.source,
      state: registry.state,
      claimCount: registry.claimCount,
      entryCount: registry.entryCount,
      hostFabricReadyCount: fabricReadyCount,
      hostFabricBlockedCount: fabricBlockedCount,
    },
    edge: prepareSwarmEdgeStatus(snapshot),
    projection: prepareProjectionStatus(snapshot),
    materialization,
  };
}

export function runtimeStatusRows(snapshot, prepared, records, fallbackBuildId = "runtime-unknown") {
  const edge = normalizeObject(prepared?.edge);
  const projection = normalizeObject(prepared?.projection);
  const materialization = normalizeObject(prepared?.materialization);
  const serviceCatalog = normalizeObject(prepared?.serviceCatalog);
  const resource = normalizeObject(snapshot?.resource);
  const retention = normalizeObject(snapshot?.retention);
  const resourceReason = postureReason(resource);
  const retentionReason = postureReason(retention);
  return [
    { label: "Runtime build", value: String(snapshot?.buildId || fallbackBuildId), tone: "neutral" },
    { label: "Snapshot age", value: formatAge(snapshot?.updatedAt), tone: "neutral" },
    { label: "Projected records", value: String(normalizedArray(records).length), tone: "neutral" },
    {
      label: "Service catalog",
      value: `${Number(serviceCatalog.serviceCount || 0)} services / ${serviceCatalog.state || "unknown"}`,
      tone: Number(serviceCatalog.serviceCount || 0) > 0 ? "good" : "warn",
    },
    {
      label: "Host fabric",
      value: `${Number(serviceCatalog.hostFabricReadyCount || 0)} ready / ${Number(serviceCatalog.hostFabricBlockedCount || 0)} blocked`,
      tone: Number(serviceCatalog.hostFabricBlockedCount || 0) === 0 && Number(serviceCatalog.hostFabricReadyCount || 0) > 0 ? "good" : "warn",
    },
    {
      label: "Swarm edge",
      value: edge.connected ? `${edge.mode || "edge"} connected` : `${edge.mode || "edge"} disconnected`,
      tone: edge.connected ? "good" : "warn",
    },
    {
      label: "Swarm queue",
      value: `${Number(edge.queuedCount || 0)} queued / ${Number(edge.sentCount || 0)} sent`,
      tone: Number(edge.queuedCount || 0) === 0 ? "good" : "warn",
    },
    {
      label: "Ack status",
      value: String(edge.ackLabel || "unknown"),
      tone: String(edge.ackLabel || "") === "clear" ? "good" : "warn",
    },
    {
      label: "Reject status",
      value: `${Number(edge.rejectCount || 0)} ${edge.rejectLabel || "none"}`,
      tone: Number(edge.rejectCount || 0) === 0 ? "good" : "bad",
    },
    {
      label: "Projection repair",
      value: `${Number(edge.repairCount || 0)} ${edge.repairLabel || "none"}`,
      tone: Number(edge.repairCount || 0) === 0 ? "good" : "warn",
    },
    {
      label: "Projection sync",
      value: `${Number(projection.projectionCount || 0)} retained / ${projection.stateLabel || "none"}`,
      tone: Number(projection.projectionCount || 0) > 0 ? "good" : "warn",
    },
    {
      label: "Materialization",
      value: [
        materialization.state || "unknown",
        materialization.budgetId || `${Number(materialization.budgetCount || 0)} budgets`,
      ].filter(Boolean).join(" / "),
      tone: ["withinBudget", "materialized"].includes(String(materialization.state || "")) ? "good" : "warn",
    },
    {
      label: "Resource posture",
      value: [postureState(resource), resourceReason].filter(Boolean).join(" / "),
      tone: resource.cleanupAllowed === true ? "good" : "warn",
    },
    {
      label: "Retention posture",
      value: [postureState(retention), retentionReason].filter(Boolean).join(" / "),
      tone: retention.releaseRequired === true ? "warn" : "good",
    },
  ];
}

function formatAge(ts) {
  const at = Number(ts || 0);
  if (!at) return "unknown";
  const ageSec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h ago`;
  const ageDay = Math.floor(ageHr / 24);
  return `${ageDay}d ago`;
}

export function captureActiveFieldState(doc = globalThis.document) {
  const active = doc?.activeElement;
  const key = String(active?.dataset?.preserveInputKey || "").trim();
  if (!active || !key || !("value" in active)) return null;
  return {
    key,
    value: String(active.value ?? ""),
    selectionStart: Number.isFinite(Number(active.selectionStart)) ? Number(active.selectionStart) : null,
    selectionEnd: Number.isFinite(Number(active.selectionEnd)) ? Number(active.selectionEnd) : null,
  };
}

export function restoreActiveFieldState(state, doc = globalThis.document) {
  if (!state?.key || !doc?.querySelectorAll) return false;
  const fields = Array.from(doc.querySelectorAll("[data-preserve-input-key]"));
  const target = fields.find((field) => String(field?.dataset?.preserveInputKey || "") === state.key);
  if (!target || !("value" in target)) return false;
  target.value = state.value;
  if (typeof target.focus === "function") target.focus();
  if (
    state.selectionStart !== null
    && state.selectionEnd !== null
    && typeof target.setSelectionRange === "function"
  ) {
    try {
      target.setSelectionRange(state.selectionStart, state.selectionEnd);
    } catch {}
  }
  return true;
}
