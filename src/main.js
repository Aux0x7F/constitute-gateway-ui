import "constitute-ui/styles.css";
import "./styles.css";
import {
  renderActionList,
  renderFirstPartyShell,
  setConnectionStateText,
} from "constitute-ui";
import {
  captureActiveFieldState,
  prepareRuntimeSnapshotModel,
  restoreActiveFieldState,
  runtimeStatusRows,
} from "./runtime-model.js";
import {
  PLATFORM_RUNTIME_BUILD_ID as RUNTIME_WORKER_BUILD_ID,
  runtimeAttachDebugInfo,
  runtimeSharedWorkerName,
  runtimeWorkerScriptUrl as accountRuntimeWorkerScriptUrl,
} from "../../constitute-account/runtime-contract.js";
import { RUNTIME_DIAGNOSTIC_OPERATOR_PLANES, attachRuntimeDiagnostics } from "../../constitute-account/runtime-diagnostics.js";
import {
  browserStorageShellContext,
  deriveRuntimeShellState,
} from "constitute-ui/runtime-shell-state";
import {
  gatewayRuntimeClientModule,
  gatewaySurfaceAttachContext,
} from "./surface-app-contract.js";

const RUNTIME_ATTACH_TIMEOUT_MS = 5_000;
const RUNTIME_WRITE_TIMEOUT_MS = 10_000;
const GATEWAY_ACTION_TIMEOUT_MS = 120_000;
const EXTRA_ZONES_STORAGE_KEY = "constitute.gateway-ui.extra-zones";

const GATEWAY_MAIN_HTML = `
  <div class="gatewayMain">
    <section id="gatewayViewGateways" class="gatewayView">
      <section class="cuPanel">
        <div class="cuPanelHeader">
          <div>
            <h2 class="cuPanelTitle">Gateways</h2>
            <p class="cuPanelHint">Owned, shared, and discoverable gateways from the shared browser runtime.</p>
          </div>
          <div class="gatewayActionStrip">
            <button id="btnGatewayRefresh" type="button" class="cuAction">Refresh Snapshot</button>
          </div>
        </div>
        <div id="gatewayStatus" class="gatewayInlineStatus"></div>
        <div id="gatewayList" class="gatewayList"></div>
      </section>
    </section>

    <section id="gatewayViewServices" class="gatewayView hidden">
      <section class="cuPanel">
        <div class="cuPanelHeader">
          <div>
            <h2 class="cuPanelTitle">Hosted Services</h2>
            <p class="cuPanelHint">Installed gateway services with health, configuration, and optional app actions.</p>
          </div>
        </div>
        <div id="serviceStatus" class="gatewayInlineStatus"></div>
        <div id="serviceList" class="gatewayList"></div>
      </section>
    </section>

    <section id="gatewayViewNetwork" class="gatewayView hidden">
      <div class="gatewayGrid">
        <section class="cuPanel">
          <div class="cuPanelHeader">
            <div>
              <h2 class="cuPanelTitle">Network</h2>
              <p class="cuPanelHint">Shared runtime connection summary and current zone availability.</p>
            </div>
          </div>
          <div id="networkSummary" class="gatewayCardRows"></div>
        </section>
        <section class="cuPanel">
          <div class="cuPanelHeader">
            <div>
              <h2 class="cuPanelTitle">Zones</h2>
              <p class="cuPanelHint">Zones synced from the account/runtime surface.</p>
            </div>
          </div>
          <div id="zonesSummary" class="gatewayCardRows"></div>
        </section>
      </div>
    </section>

    <section id="gatewayViewSecurity" class="gatewayView hidden">
      <div class="gatewaySectionStack">
        <section class="cuPanel">
          <div class="cuPanelHeader">
            <div>
              <h2 class="cuPanelTitle">Cybersecurity</h2>
              <p class="cuPanelHint">Host cybersecurity projection will land here once constitute-cybersec is active.</p>
            </div>
          </div>
          <div id="securitySummary" class="gatewayCardRows"></div>
        </section>
      </div>
    </section>

    <section id="gatewayViewRuntime" class="gatewayView hidden">
      <div class="gatewayGrid">
        <section class="cuPanel">
          <div class="cuPanelHeader">
            <div>
              <h2 class="cuPanelTitle">Runtime</h2>
              <p class="cuPanelHint">Shared runtime build, snapshot age, and browser-side status.</p>
            </div>
          </div>
          <div id="runtimeSummary" class="gatewayCardRows"></div>
        </section>
        <section class="cuPanel">
          <div class="cuPanelHeader">
            <div>
              <h2 class="cuPanelTitle">Issues</h2>
              <p class="cuPanelHint">Managed-service issues surfaced by the shared runtime.</p>
            </div>
          </div>
          <div id="issueSummary" class="gatewayCardRows"></div>
        </section>
      </div>
    </section>
  </div>
`;

const app = document.querySelector("#app");
if (!app) throw new Error("#app not found");

const shell = renderFirstPartyShell(app, {
  appName: "Gateway",
  navItems: [
    { id: "gateways", label: "Gateways", active: true },
    { id: "services", label: "Hosted Services" },
    { id: "network", label: "Network" },
    { id: "security", label: "Cybersecurity" },
    { id: "runtime", label: "Runtime / Updates" },
  ],
  mainHtml: GATEWAY_MAIN_HTML,
  accountCenterTitle: "",
});

const btnBellEl = shell.btnBellEl;
const notifMenuEl = shell.notifMenuEl;
const btnNotifClearEl = shell.btnNotifClearEl;
const notifListEl = shell.notifListEl;
const btnMenuEl = shell.btnMenuEl;
const drawerEl = shell.drawerEl;
const drawerBackdropEl = shell.drawerBackdropEl;
const btnDrawerCloseEl = shell.btnDrawerCloseEl;
const navButtons = shell.navButtons;
const accountRailButtonEl = shell.accountRailButtonEl;
const accountCenterMenuEl = shell.accountCenterMenuEl;
const accountCenterSummaryEl = shell.accountCenterSummaryEl;
const accountCenterActionsEl = shell.accountCenterActionsEl;
const identityHandleEl = shell.identityHandleEl;
const connStateTextEl = shell.connStateTextEl;
const connPopoverEl = shell.connPopoverEl;
const popConnectionEl = shell.popConnectionEl;
const popRelayEl = shell.popRelayEl;
const popGatewayEl = shell.popGatewayEl;
const popServicesEl = shell.popServicesEl;
const popConnectionReasonEl = shell.popConnectionReasonEl;
const panePathEl = shell.panePathEl;

const bootSplashEl = document.getElementById("bootSplash");
const bootSplashTitleEl = document.getElementById("bootSplashTitle");
const bootSplashStatusEl = document.getElementById("bootSplashStatus");

const gatewaysViewEl = document.getElementById("gatewayViewGateways");
const servicesViewEl = document.getElementById("gatewayViewServices");
const networkViewEl = document.getElementById("gatewayViewNetwork");
const securityViewEl = document.getElementById("gatewayViewSecurity");
const runtimeViewEl = document.getElementById("gatewayViewRuntime");

const gatewayStatusEl = document.getElementById("gatewayStatus");
const gatewayListEl = document.getElementById("gatewayList");
const btnGatewayRefreshEl = document.getElementById("btnGatewayRefresh");
const serviceStatusEl = document.getElementById("serviceStatus");
const serviceListEl = document.getElementById("serviceList");
const networkSummaryEl = document.getElementById("networkSummary");
const zonesSummaryEl = document.getElementById("zonesSummary");
const securitySummaryEl = document.getElementById("securitySummary");
const runtimeSummaryEl = document.getElementById("runtimeSummary");
const issueSummaryEl = document.getElementById("issueSummary");

const notifications = [];
let notificationMenuOpen = false;
let accountCenterOpen = false;
let bootSplashDismissed = false;
let currentActivity = "gateways";
let runtimeReady = false;
let runtimeSnapshot = null;
let runtimeSnapshotMaterializationBudget = null;
let runtimeSnapshotConsumerFloor = null;
let runtimeDiagnosticsAgent = null;
let runtimeClient = null;
let preparedRuntimeSnapshot = prepareRuntimeSnapshotModel(null);
let accountBridgeFrame = null;
let accountBridgePromise = null;

function runtimeWorkerUrl() {
  return accountRuntimeWorkerScriptUrl(window.location.origin);
}

function accountBridgeUrl() {
  const target = new URL("/constitute-account/", window.location.origin);
  target.searchParams.set("bridge", "1");
  return target.toString();
}

function isRuntimeBrokerUnavailable(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("runtime broker unavailable") || message.includes("runtime broker missing");
}

async function ensureAccountBridge(reason = "") {
  if (accountBridgePromise) return await accountBridgePromise;
  accountBridgePromise = new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    accountBridgeFrame = document.getElementById("constituteAccountBridge");
    if (!accountBridgeFrame) {
      const iframe = document.createElement("iframe");
      iframe.id = "constituteAccountBridge";
      iframe.hidden = true;
      iframe.tabIndex = -1;
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none";
      iframe.src = accountBridgeUrl();
      iframe.addEventListener("load", () => window.setTimeout(done, 450), { once: true });
      document.body.appendChild(iframe);
      accountBridgeFrame = iframe;
    } else {
      window.setTimeout(done, 450);
    }
    window.setTimeout(done, 1_500);
    if (reason) console.info("[gateway-ui] account bridge", reason);
  });
  try {
    await accountBridgePromise;
  } finally {
    accountBridgePromise = null;
  }
}

function setBootSplash(title = "Loading", status = "") {
  if (bootSplashDismissed) return;
  if (bootSplashTitleEl) bootSplashTitleEl.textContent = String(title || "Loading");
  if (bootSplashStatusEl) {
    const text = String(status || "").trim();
    bootSplashStatusEl.textContent = text;
    bootSplashStatusEl.hidden = !text;
  }
  document.body.classList.add("booting");
}

function dismissBootSplash() {
  if (bootSplashDismissed || !bootSplashEl) return;
  bootSplashDismissed = true;
  document.body.classList.remove("booting");
  window.setTimeout(() => {
    try { bootSplashEl.remove(); } catch {}
  }, 220);
}

function addNotification(tone, title, body) {
  notifications.unshift({
    id: randomOpaqueId("notif"),
    tone: String(tone || "neutral"),
    title: String(title || "").trim(),
    body: String(body || "").trim(),
    ts: Date.now(),
    read: false,
  });
  while (notifications.length > 16) notifications.pop();
  renderNotifications();
}

function renderNotifications() {
  notifListEl.innerHTML = "";
  btnBellEl.classList.toggle("has-unread", notifications.some((entry) => !entry.read));
  if (notifications.length === 0) {
    notifListEl.innerHTML = `<div class="notificationItem"><div class="notificationTitle">No notifications</div><div class="notificationBody">Gateway action results appear here.</div></div>`;
    return;
  }
  for (const entry of notifications.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = `notificationItem ${entry.tone}`;
    item.innerHTML = `
      <div class="notificationTitle">${escapeHtml(entry.title)}</div>
      <div class="notificationBody">${escapeHtml(entry.body)}</div>
      <div class="notificationMeta">
        <span>${escapeHtml(new Date(entry.ts).toLocaleTimeString())}</span>
      </div>
    `;
    item.addEventListener("click", () => {
      entry.read = true;
      renderNotifications();
      closeNotificationMenu();
    });
    notifListEl.appendChild(item);
  }
}

function openNotificationMenu() {
  notificationMenuOpen = true;
  notifMenuEl.classList.remove("hidden");
}

function closeNotificationMenu() {
  notificationMenuOpen = false;
  notifMenuEl.classList.add("hidden");
}

function toggleNotificationMenu() {
  if (notificationMenuOpen) {
    closeNotificationMenu();
    return;
  }
  openNotificationMenu();
}

function openDrawer() {
  drawerEl.classList.remove("hidden");
  drawerBackdropEl.classList.remove("hidden");
}

function closeDrawer() {
  drawerEl.classList.add("hidden");
  drawerBackdropEl.classList.add("hidden");
}

function openAccountCenter() {
  accountCenterOpen = true;
  accountRailButtonEl.setAttribute("aria-expanded", "true");
  accountCenterMenuEl.classList.remove("hidden");
}

function closeAccountCenter() {
  accountCenterOpen = false;
  accountRailButtonEl.setAttribute("aria-expanded", "false");
  accountCenterMenuEl.classList.add("hidden");
}

function toggleAccountCenter() {
  if (accountCenterOpen) {
    closeAccountCenter();
    return;
  }
  openAccountCenter();
}

function shortPk(value, head = 12, tail = 6) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  if (raw.length <= head + tail + 1) return raw;
  return `${raw.slice(0, head)}…${raw.slice(-tail)}`;
}

function randomOpaqueId(prefix) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${token}`;
}

function normalizedArray(value) {
  return Array.isArray(value) ? value : [];
}

function runtimeCall(type, payload = {}, timeoutMs = 20_000) {
  return runtimeClient?.call(type, payload, timeoutMs)
    || Promise.reject(new Error("shared runtime is unavailable"));
}

async function runtimeBrokerCall(type, payload = {}, timeoutMs = 20_000, reason = "") {
  try {
    return await runtimeCall(type, payload, timeoutMs);
  } catch (error) {
    if (!isRuntimeBrokerUnavailable(error)) throw error;
    await ensureAccountBridge(reason || type);
    return await runtimeCall(type, payload, timeoutMs);
  }
}

function absorbRuntimeSnapshot(snapshot) {
  runtimeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : null;
  runtimeReady = Boolean(runtimeSnapshot);
  renderSnapshotState();
  const managed = runtimeSnapshot?.managedAppliances || {};
  const projectedCount = normalizedArray(managed?.owned).length
    + normalizedArray(managed?.granted).length
    + normalizedArray(managed?.discoverable).length;
  if (projectedCount === 0) {
    void ensureAccountBridge("hydrate managed appliance projection");
  }
}

function attachRuntime() {
  if (typeof SharedWorker === "undefined") return null;
  const debugEnabled = new URLSearchParams(window.location.search || "").get("debug") === "1";
  runtimeClient = gatewayRuntimeClientModule.createRuntimeSurfaceClient({
    clientId: "gateway-ui",
    surface: "gateway-ui",
    workerUrl: runtimeWorkerUrl(),
    workerName: runtimeSharedWorkerName(),
    attachTimeoutMs: RUNTIME_ATTACH_TIMEOUT_MS,
    callTimeoutMs: 20_000,
    debug: debugEnabled,
    debugInfo: runtimeAttachDebugInfo(window.location.origin),
    logPrefix: "gateway-ui",
    attachContext: gatewaySurfaceAttachContext,
    onPort: (port) => {
      runtimeDiagnosticsAgent = attachRuntimeDiagnostics({
        port,
        surface: "constitute-gateway-ui",
        clientId: "gateway-ui",
        enabled: debugEnabled,
        planes: RUNTIME_DIAGNOSTIC_OPERATOR_PLANES,
        minLevelByPlane: { diagnostic: "warn" },
        denyKinds: ["projection.applied", "projection.ignored"],
      });
    },
    onMessage: (msg) => runtimeDiagnosticsAgent?.handleMessage(msg) === true,
    onSnapshot: (snapshot) => {
      absorbRuntimeSnapshot(snapshot || null);
      dismissBootSplash();
    },
    onMaterializationBudget: (budget) => {
      runtimeSnapshotMaterializationBudget = budget && typeof budget === "object" ? budget : null;
    },
    onConsumerFloor: (floor) => {
      runtimeSnapshotConsumerFloor = floor && typeof floor === "object" ? floor : null;
    },
    onAttachTimeout: () => {
      if (!bootSplashDismissed) dismissBootSplash();
    },
    onAttachPosture: (posture) => {
      if (!posture || posture.severity === "info") return;
      console.info("[gateway-ui] runtime attach fallback", {
        state: posture.state,
        severity: posture.severity,
        reason: posture.reason,
      });
    },
    onAttachError: () => {
      window.setTimeout(() => dismissBootSplash(), 350);
    },
  });
  const port = runtimeClient.attach();
  if (port) void ensureAccountBridge("gateway-ui startup");
  return port;
}

function identitySummary() {
  const shellState = deriveRuntimeShellState(runtimeSnapshot, { context: browserStorageShellContext() });
  return {
    linked: shellState.identity.linked,
    identityId: shellState.identity.identityId,
    label: shellState.identity.handle,
    authorityState: shellState.identity.authorityState,
  };
}

function setConnectionSummaryFromSnapshot() {
  const shellState = deriveRuntimeShellState(runtimeSnapshot, { context: browserStorageShellContext() });

  identityHandleEl.textContent = shellState.identity.handle;
  identityHandleEl.classList.toggle("identityHandle-linked", shellState.identity.linked);
  identityHandleEl.classList.toggle("identityHandle-unlinked", !shellState.identity.linked);
  identityHandleEl.title = shellState.identity.title;
  identityHandleEl.setAttribute("aria-label", shellState.identity.ariaLabel);

  const connectionLabel = shellState.connection.label;
  setConnectionStateText(connStateTextEl, {
    label: connectionLabel,
    toneClass: shellState.connection.toneClass,
  });
  popConnectionEl.textContent = connectionLabel;
  popRelayEl.textContent = shellState.relay.state;
  popGatewayEl.textContent = shellState.gateway.state;
  popServicesEl.textContent = shellState.services.state;
  popConnectionReasonEl.textContent = shellState.connection.reason;
}

function labelForIdentity(identityId) {
  const runtimeLabel = String(runtimeSnapshot?.shell?.identity?.label || "").trim().replace(/^@+/, "");
  if (runtimeLabel) return `@${runtimeLabel}`;
  const raw = String(identityId || "").trim();
  if (!raw) return "@unlinked";
  return "@linked";
}

function setActivity(activity) {
  currentActivity = String(activity || "gateways").trim().toLowerCase() || "gateways";
  gatewaysViewEl.classList.toggle("hidden", currentActivity !== "gateways");
  servicesViewEl.classList.toggle("hidden", currentActivity !== "services");
  networkViewEl.classList.toggle("hidden", currentActivity !== "network");
  securityViewEl.classList.toggle("hidden", currentActivity !== "security");
  runtimeViewEl.classList.toggle("hidden", currentActivity !== "runtime");
  if (panePathEl) panePathEl.textContent = currentActivity === "gateways" ? "" : currentActivity;
  for (const button of navButtons) {
    button.classList.toggle("active", String(button.dataset.activity || "").trim() === currentActivity);
  }
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function isGatewayRecord(record) {
  const role = normalizeRole(record?.role || record?.type || "");
  const service = normalizeRole(record?.service || "");
  return role === "gateway" || service === "gateway";
}

function isServiceRecord(record) {
  return !isGatewayRecord(record) && Boolean(normalizeRole(record?.service || ""));
}

function hostedNvrForGateway(gatewayRecord, records) {
  const gatewayPk = String(gatewayRecord?.devicePk || gatewayRecord?.pk || "").trim();
  if (!gatewayPk) return null;
  const serviceRecord = records.find((record) => {
    if (!isServiceRecord(record)) return false;
    if (normalizeRole(record?.service || "") !== "nvr") return false;
    return String(record?.hostGatewayPk || record?.host_gateway_pk || "").trim() === gatewayPk;
  });
  if (serviceRecord) return serviceRecord;
  const embedded = normalizedArray(gatewayRecord?.hostedServices || gatewayRecord?.hosted_services)
    .find((service) => normalizeRole(service?.service || service?.slug || service?.name || service) === "nvr");
  if (!embedded || typeof embedded !== "object") return null;
  return {
    ...embedded,
    __scope: gatewayRecord.__scope,
    hostGatewayPk: String(embedded.hostGatewayPk || embedded.host_gateway_pk || gatewayPk).trim(),
  };
}

function gatewayReportsNvrService(gatewayRecord) {
  return normalizedArray(gatewayRecord?.hostedServices || gatewayRecord?.hosted_services)
    .some((service) => normalizeRole(service?.service || service?.slug || service?.name || service) === "nvr");
}

function serviceSlug(record) {
  return normalizeRole(record?.service || record?.slug || record?.name || "");
}

function serviceStatus(record) {
  const direct = String(record?.status || "").trim();
  if (direct) return direct;
  const healthStatus = String(record?.facts?.health?.status || "").trim();
  if (healthStatus) return healthStatus === "ok" ? "online" : healthStatus;
  return freshnessLabel(record);
}

function installedServicesForGateway(gatewayRecord, records) {
  const gatewayPk = String(gatewayRecord?.devicePk || gatewayRecord?.pk || "").trim();
  if (!gatewayPk) return [];
  return collectInstalledServices(records)
    .filter((record) => String(record?.hostGatewayPk || record?.host_gateway_pk || "").trim() === gatewayPk);
}

function mergeServiceRecord(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && !value.trim()) return false;
      return true;
    })),
    facts: {
      ...(existing.facts && typeof existing.facts === "object" ? existing.facts : {}),
      ...(incoming.facts && typeof incoming.facts === "object" ? incoming.facts : {}),
    },
    __scope: existing.__scope || incoming.__scope,
  };
}

function collectInstalledServices(records) {
  const byKey = new Map();
  const add = (record, gatewayRecord = null) => {
    if (!record || typeof record !== "object") return;
    const service = serviceSlug(record);
    if (!service) return;
    const hostGatewayPk = String(
      record.hostGatewayPk
      || record.host_gateway_pk
      || gatewayRecord?.devicePk
      || gatewayRecord?.pk
      || "",
    ).trim();
    const devicePk = String(record.devicePk || record.pk || record.servicePk || record.service_pk || "").trim();
    const key = `${hostGatewayPk}:${service}:${devicePk || service}`;
    const normalized = {
      ...record,
      devicePk,
      service,
      hostGatewayPk,
      __scope: record.__scope || gatewayRecord?.__scope,
      __hostGatewayLabel: gatewayRecord ? gatewayTitle(gatewayRecord) : "",
    };
    byKey.set(key, mergeServiceRecord(byKey.get(key), normalized));
  };
  for (const record of records) {
    if (isServiceRecord(record)) add(record);
  }
  for (const gateway of records.filter((record) => isGatewayRecord(record))) {
    for (const service of normalizedArray(gateway?.hostedServices || gateway?.hosted_services)) {
      if (service && typeof service === "object") add(service, gateway);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => `${serviceSlug(a)}:${serviceTitle(a)}`.localeCompare(`${serviceSlug(b)}:${serviceTitle(b)}`));
}

function freshnessLabel(record) {
  const at = Number(record?.managedAvailabilityUpdatedAt || record?.updatedAt || record?.updated_at || record?.ts || 0);
  if (!at) return "unknown";
  const ageMs = Math.max(0, Date.now() - at);
  if (ageMs <= 2 * 60 * 1000) return "live";
  if (ageMs <= 15 * 60 * 1000) return "recent";
  if (ageMs <= 2 * 60 * 60 * 1000) return "stale";
  return "offline";
}

function scopePill(scope) {
  const value = String(scope || "discoverable").trim();
  const label = value === "owned" ? "Owned" : (value === "shared" ? "Shared" : (value === "runtime" ? "Runtime" : "Discoverable"));
  return `<span class="gatewayScopePill ${escapeHtml(value)}">${escapeHtml(label)}</span>`;
}

function gatewayTitle(record) {
  const label = String(record?.deviceLabel || record?.label || "").trim();
  return label || `Gateway ${shortPk(record?.devicePk || record?.pk || "")}`;
}

function serviceTitle(record) {
  const label = String(record?.deviceLabel || record?.label || "").trim();
  const service = normalizeRole(record?.service || "") || "service";
  return label || `${service.charAt(0).toUpperCase()}${service.slice(1)} ${shortPk(record?.devicePk || record?.pk || "")}`;
}

function extraZonesForGateway(gatewayPk) {
  try {
    const raw = localStorage.getItem(EXTRA_ZONES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const value = parsed && typeof parsed === "object" ? parsed[String(gatewayPk || "").trim()] : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function setExtraZonesForGateway(gatewayPk, extraZones) {
  const key = String(gatewayPk || "").trim();
  if (!key) return;
  let parsed = {};
  try {
    const raw = localStorage.getItem(EXTRA_ZONES_STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") parsed = {};
  } catch {
    parsed = {};
  }
  if (Array.isArray(extraZones) && extraZones.length > 0) parsed[key] = extraZones;
  else delete parsed[key];
  try {
    localStorage.setItem(EXTRA_ZONES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

function parseZoneKeyList(input) {
  const values = String(input || "")
    .split(/[\s,]+/)
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return values.filter((value, index) => values.indexOf(value) === index);
}

function renderGatewayList(records) {
  gatewayListEl.innerHTML = "";
  const gateways = records.filter((record) => isGatewayRecord(record));
  gatewayStatusEl.textContent = gateways.length === 0 ? "No gateways are currently projected." : "";
  gatewayStatusEl.classList.toggle("hidden", gateways.length > 0);
  if (gateways.length === 0) {
    gatewayListEl.innerHTML = `<article class="gatewayEmpty">Open constitute-account to hydrate the shared runtime if this browser has never seen your gateway inventory.</article>`;
    return;
  }
  for (const record of gateways) {
    const gatewayPk = String(record?.devicePk || record?.pk || "").trim();
    const nvrRecord = hostedNvrForGateway(record, records);
    const installedServices = installedServicesForGateway(record, records);
    const row = document.createElement("article");
    row.className = "gatewayListItem";
    row.innerHTML = `
      <div class="gatewayListHeader">
        <div>
          <h3 class="gatewayListTitle">${escapeHtml(gatewayTitle(record))}</h3>
          <div class="gatewayListMeta">
            <div>id ${escapeHtml(shortPk(gatewayPk))}</div>
            <div>freshness ${escapeHtml(freshnessLabel(record))}</div>
            <div>installed services ${escapeHtml(String(installedServices.length || 0))}</div>
          </div>
        </div>
        ${scopePill(record.__scope)}
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "gatewayActionStrip";
    const zoneInput = document.createElement("input");
    zoneInput.type = "text";
    zoneInput.className = "gatewayInlineInput";
    zoneInput.placeholder = "extra zones";
    zoneInput.value = extraZonesForGateway(gatewayPk).join(", ");
    zoneInput.dataset.preserveInputKey = `gateway-zone-sync:${gatewayPk}`;
    zoneInput.addEventListener("input", () => {
      setExtraZonesForGateway(gatewayPk, parseZoneKeyList(zoneInput.value));
    });

    const openNvrButton = actionButton(nvrRecord ? "Open Security Cameras" : "Open Security Cameras", () => {
      void openSecurityCameras(nvrRecord || {
        devicePk: String(nvrRecord?.devicePk || "").trim(),
        hostGatewayPk: gatewayPk,
        service: "nvr",
      }, {});
    }, !nvrRecord);
    if (!nvrRecord) openNvrButton.title = "NVR service is not projected for this gateway yet.";
    actions.appendChild(openNvrButton);

    if (!nvrRecord && !gatewayReportsNvrService(record)) {
      const installButton = actionButton("Install NVR Service", () => {
        void requestGatewayInstall(record);
      });
      actions.appendChild(installButton);
    }

    const zoneSyncButton = actionButton("Sync Zones", () => {
      void requestZoneSync(record, { extraZoneText: zoneInput.value });
    });
    actions.appendChild(zoneInput);
    actions.appendChild(zoneSyncButton);

    row.appendChild(actions);
    gatewayListEl.appendChild(row);
  }
}

function renderServiceList(records) {
  serviceListEl.innerHTML = "";
  const services = collectInstalledServices(records);
  serviceStatusEl.textContent = services.length > 0
    ? `${services.length} installed service${services.length === 1 ? "" : "s"} projected from runtime catalog/snapshot.`
    : "No installed services are currently projected.";
  if (services.length === 0) {
    serviceListEl.innerHTML = `<article class="gatewayEmpty">No installed services are currently projected.</article>`;
    return;
  }
  for (const record of services) {
    const servicePk = String(record?.devicePk || record?.pk || "").trim();
    const service = serviceSlug(record);
    const status = serviceStatus(record);
    const facts = record?.facts && typeof record.facts === "object" ? record.facts : {};
    const health = facts?.health && typeof facts.health === "object" ? facts.health : {};
    const factRows = service === "storage"
      ? [
          `objects ${Number(health.objects || 0)}`,
          `chunks ${Number(health.chunks || 0)}`,
          `index shards ${Number(health.indexShards || 0)}`,
          `pins ${Number(health.pinLeases || 0)}`,
        ]
      : service === "logging"
        ? [
            `events ${Number(health.events || 0)}`,
            `producers ${Number(health.producers || 0)}`,
            `storage ${String(health.storageStatus || "unknown")}`,
          ]
      : [
          Number(record?.cameraCount || record?.camera_count || 0) > 0
            ? `camera sources ${Number(record?.cameraCount || record?.camera_count || 0)}`
            : "",
        ].filter(Boolean);
    const row = document.createElement("article");
    row.className = "gatewayListItem";
    row.innerHTML = `
      <div class="gatewayListHeader">
        <div>
          <h3 class="gatewayListTitle">${escapeHtml(serviceTitle(record))}</h3>
          <div class="gatewayListMeta">
            <div>id ${escapeHtml(shortPk(servicePk))}</div>
            <div>service ${escapeHtml(service || "unknown")}</div>
            <div>status <span class="gatewayStatusTone-${escapeHtml(toneForLabel(status))}">${escapeHtml(status)}</span></div>
            <div>host gateway ${escapeHtml(record.__hostGatewayLabel || shortPk(record?.hostGatewayPk || record?.host_gateway_pk || ""))}</div>
            <div>source ${escapeHtml(record.__source === "serviceRegistry" ? "service registry" : record.__source === "serviceCatalog" ? "runtime catalog" : "runtime snapshot")}</div>
            <div>freshness ${escapeHtml(freshnessLabel(record))}</div>
            ${factRows.map((fact) => `<div>${escapeHtml(fact)}</div>`).join("")}
          </div>
        </div>
        ${scopePill(record.__scope)}
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "gatewayActionStrip";
    if (service === "nvr") {
      actions.appendChild(actionButton("Open Security Cameras", () => {
        void openSecurityCameras(record, {});
      }, !servicePk));
      actions.appendChild(actionButton("Camera Settings", () => {
        void openSecurityCameras(record, { activity: "settings" });
      }, !servicePk));
    } else if (service === "logging") {
      actions.appendChild(actionButton("Open Logging", () => {
        void openLogging(record);
      }, !servicePk));
    }
    if (actions.childElementCount > 0) row.appendChild(actions);
    serviceListEl.appendChild(row);
  }
}

function actionButton(label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cuAction";
  button.textContent = String(label || "");
  button.disabled = Boolean(disabled);
  if (typeof onClick === "function") button.addEventListener("click", onClick);
  return button;
}

function renderRows(container, rows) {
  container.innerHTML = "";
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = "gatewayCardRow";
    el.innerHTML = `
      <span class="gatewayCardRowLabel">${escapeHtml(String(row.label || ""))}</span>
      <span class="gatewayStatusTone-${escapeHtml(String(row.tone || "neutral"))}">${escapeHtml(String(row.value || ""))}</span>
    `;
    container.appendChild(el);
  }
}

function renderNetworkView(records) {
  const shellState = deriveRuntimeShellState(runtimeSnapshot, { context: browserStorageShellContext() });
  renderRows(networkSummaryEl, [
    { label: "Connection", value: shellState.connection.label, tone: toneForLabel(shellState.connection.label) },
    { label: "Relay", value: shellState.relay.state, tone: toneForLabel(shellState.relay.state) },
    { label: "Services", value: shellState.services.state, tone: toneForLabel(shellState.services.state) },
  ]);
  renderRows(zonesSummaryEl, [
    {
      label: "Identity authority",
      value: shellState.identity.linked ? titleCaseWords(shellState.identity.authorityState) : "Unlinked",
      tone: shellState.identity.linked && shellState.identity.authorityState !== "unlinked" ? "good" : "warn",
    },
    { label: "Runtime snapshot age", value: formatAge(runtimeSnapshot?.updatedAt), tone: "neutral" },
  ]);
}

function renderSecurityView(records) {
  renderRows(securitySummaryEl, [
    { label: "Current posture", value: "Shared chrome active; cybersecurity service not yet projected.", tone: "warn" },
    { label: "Future authority", value: "constitute-cybersec", tone: "neutral" },
  ]);
}

function renderRuntimeView(records, prepared = preparedRuntimeSnapshot) {
  const issue = runtimeSnapshot?.managedServiceIssue || null;
  renderRows(runtimeSummaryEl, runtimeStatusRows(runtimeSnapshot, prepared, records, RUNTIME_WORKER_BUILD_ID));
  if (!issue) {
    renderRows(issueSummaryEl, [
      { label: "Managed services", value: "No active runtime issue", tone: "good" },
    ]);
    return;
  }
  renderRows(issueSummaryEl, [
    { label: "Service", value: String(issue?.service || "unknown"), tone: "warn" },
    { label: "State", value: String(issue?.state || "unknown"), tone: "warn" },
    { label: "Reason", value: String(issue?.reason || "unknown"), tone: "bad" },
  ]);
}

function toneForLabel(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("connected") || raw.includes("live") || raw.includes("open") || raw.includes("online") || raw === "ok" || raw === "linked") return "good";
  if (raw.includes("offline") || raw.includes("error") || raw.includes("failed") || raw.includes("unlinked")) return "bad";
  if (raw.includes("loading") || raw.includes("unknown") || raw.includes("stale")) return "warn";
  return "neutral";
}

function titleCaseWords(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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

function renderSnapshotState() {
  const activeFieldState = captureActiveFieldState(document);
  setConnectionSummaryFromSnapshot();
  preparedRuntimeSnapshot = prepareRuntimeSnapshotModel(runtimeSnapshot, {
    browserStorage: window.localStorage,
    materializationBudget: runtimeSnapshotMaterializationBudget,
    consumerFloor: runtimeSnapshotConsumerFloor,
  });
  const records = preparedRuntimeSnapshot.records;
  renderGatewayList(records);
  renderServiceList(records);
  renderNetworkView(records);
  renderSecurityView(records);
  renderRuntimeView(records, preparedRuntimeSnapshot);
  renderAccountCenter();
  restoreActiveFieldState(activeFieldState, document);
}

function renderAccountCenter() {
  accountCenterSummaryEl.replaceChildren();
  renderActionList(accountCenterActionsEl, [
    {
      id: "account.open_center",
      label: "Open Account Center",
      description: "Open constitute-account.",
      onSelect: () => {
        closeAccountCenter();
        window.location.assign(new URL("/constitute-account/#activity=home", window.location.origin).toString());
      },
    },
  ]);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function openSecurityCameras(record, opts = {}) {
  if (!runtimeReady) {
    addNotification("warn", "Runtime unavailable", "Open constitute-account to hydrate the shared runtime first.");
    return;
  }
  const url = buildManagedSurfaceUrl("constitute-nvr-ui", opts);
  window.open(url, "_blank", "noopener,noreferrer");
  const label = String(record?.label || record?.deviceLabel || record?.displayName || "runtime directory").trim();
  addNotification("good", "Security Cameras opened", `Opened from ${label}.`);
}

async function openLogging(record) {
  if (!runtimeReady) {
    addNotification("warn", "Runtime unavailable", "Open constitute-account to hydrate the shared runtime first.");
    return;
  }
  const url = buildManagedSurfaceUrl("constitute-logging-ui");
  window.open(url, "_blank", "noopener,noreferrer");
  const label = String(record?.label || record?.deviceLabel || record?.displayName || "runtime directory").trim();
  addNotification("good", "Logging opened", `Opened from ${label}.`);
}

async function requestGatewayInstall(record) {
  try {
    const result = await runtimeBrokerCall("gateway.service.install.request", {
      payload: { record },
    }, 20_000, "service install");
    addNotification("good", "Install requested", `Gateway install request submitted${result?.requestId ? ` (${String(result.requestId).slice(0, 12)}...)` : ""}.`);
  } catch (error) {
    addNotification("bad", "Install request failed", String(error?.message || error));
  }
}

async function requestZoneSync(record, opts = {}) {
  const gatewayPk = String(record?.devicePk || record?.pk || "").trim();
  const existing = extraZonesForGateway(gatewayPk);
  const entered = Object.hasOwn(opts, "extraZoneText")
    ? String(opts.extraZoneText || "")
    : window.prompt(
        "Extra gateway zone keys (comma or space separated). Identity zones are always synced automatically.",
        existing.join(", "),
      );
  if (entered === null) return;
  const extraZoneKeys = parseZoneKeyList(entered);
  setExtraZonesForGateway(gatewayPk, extraZoneKeys);
  try {
    const result = await runtimeBrokerCall("gateway.zones.sync.request", {
      payload: { record, extraZoneKeys },
    }, 20_000, "zone sync");
    addNotification("good", "Zone sync requested", `Gateway zone sync submitted${result?.requestId ? ` (${String(result.requestId).slice(0, 12)}...)` : ""}.`);
  } catch (error) {
    addNotification("bad", "Zone sync failed", String(error?.message || error));
  }
}

function buildManagedSurfaceUrl(repo, opts = {}) {
  const target = new URL(`/${String(repo || "").trim()}/`, window.location.origin);
  const params = new URLSearchParams();
  const activity = String(opts?.activity || "").trim();
  const settingsTab = String(opts?.settingsTab || "").trim();
  const camera = String(opts?.camera || "").trim();
  if (activity) params.set("activity", activity);
  if (settingsTab) params.set("settings", settingsTab);
  if (camera) params.set("camera", camera);
  target.hash = params.toString();
  return target.toString();
}

function bindUi() {
  btnBellEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotificationMenu();
  });
  btnNotifClearEl.addEventListener("click", () => {
    notifications.splice(0, notifications.length);
    renderNotifications();
  });
  btnMenuEl.addEventListener("click", openDrawer);
  btnDrawerCloseEl.addEventListener("click", closeDrawer);
  drawerBackdropEl.addEventListener("click", closeDrawer);
  accountRailButtonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAccountCenter();
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (notificationMenuOpen && target instanceof Node && !notifMenuEl.contains(target) && !btnBellEl.contains(target)) {
      closeNotificationMenu();
    }
    if (accountCenterOpen && target instanceof Node && !accountCenterMenuEl.contains(target) && !accountRailButtonEl.contains(target)) {
      closeAccountCenter();
    }
  });
  connPopoverEl.classList.add("hidden");
  shell.connWrapEl.addEventListener("mouseenter", () => connPopoverEl.classList.remove("hidden"));
  shell.connWrapEl.addEventListener("mouseleave", () => connPopoverEl.classList.add("hidden"));
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActivity(button.dataset.activity || "gateways");
      closeDrawer();
    });
  });
  btnGatewayRefreshEl.addEventListener("click", () => {
    void runtimeCall("runtime.snapshot.get").then((snapshot) => {
      absorbRuntimeSnapshot(snapshot || null);
      addNotification("good", "Snapshot refreshed", "Shared runtime snapshot updated.");
    }).catch((error) => {
      addNotification("bad", "Snapshot refresh failed", String(error?.message || error));
    });
  });
}

bindUi();
renderNotifications();
setActivity("gateways");
setBootSplash("Loading");
attachRuntime();

void runtimeCall("runtime.snapshot.get").then((snapshot) => {
  absorbRuntimeSnapshot(snapshot || null);
  dismissBootSplash();
}).catch(() => {
  dismissBootSplash();
});
