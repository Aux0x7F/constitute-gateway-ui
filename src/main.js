import "constitute-ui/styles.css";
import "./styles.css";
import {
  renderActionList,
  renderAccountCenterSummary,
  renderFirstPartyShell,
  setConnectionStateText,
} from "constitute-ui";
import { BROKER } from "constitute-protocol";

const RUNTIME_WORKER_VERSION = Object.freeze({ major: 2, minor: 9 });
const RUNTIME_WORKER_BUILD_ID = `runtime-${RUNTIME_WORKER_VERSION.major}.${RUNTIME_WORKER_VERSION.minor}`;
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
            <p class="cuPanelHint">Gateway-hosted services rendered from the shared managed-appliance projection.</p>
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
  accountCenterTitle: "Account",
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
let runtimePort = null;
let runtimeRequestSeq = 1;
const pendingRuntimeResponses = new Map();
let accountBridgeFrame = null;
let accountBridgePromise = null;

function runtimeWorkerUrl() {
  const target = new URL("/constitute-account/runtime.worker.js", window.location.origin);
  target.searchParams.set("v", RUNTIME_WORKER_BUILD_ID);
  return target.toString();
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
  if (!runtimePort) return Promise.reject(new Error("shared runtime is unavailable"));
  const requestId = `gateway-ui-${type}-${runtimeRequestSeq++}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRuntimeResponses.delete(requestId);
      reject(new Error(`${type} timed out`));
    }, timeoutMs);
    pendingRuntimeResponses.set(requestId, { resolve, reject, timer, type });
    runtimePort.postMessage({ type, requestId, clientId: "gateway-ui", ...payload });
  });
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
  try {
    const worker = new SharedWorker(runtimeWorkerUrl(), {
      type: "module",
      name: `constitute-account-runtime-${RUNTIME_WORKER_BUILD_ID}`,
    });
    const port = worker.port;
    port.start();
    port.onmessage = (event) => {
      const msg = event?.data || {};
      if (msg.type === "runtime.attached" || msg.type === "runtime.snapshot") {
        absorbRuntimeSnapshot(msg.snapshot || null);
        dismissBootSplash();
        return;
      }
      if (msg.type === "runtime.response") {
        const requestId = String(msg.requestId || "").trim();
        const pending = pendingRuntimeResponses.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        pendingRuntimeResponses.delete(requestId);
        if (msg.ok === false) pending.reject(new Error(String(msg.error || `${pending.type} failed`)));
        else pending.resolve(msg.result);
      }
    };
    port.postMessage({
      type: "runtime.attach",
      clientId: "gateway-ui",
      surface: "gateway-ui",
      broker: false,
    });
    runtimePort = port;
    void ensureAccountBridge("gateway-ui startup");
    window.setTimeout(() => {
      if (!bootSplashDismissed) dismissBootSplash();
    }, RUNTIME_ATTACH_TIMEOUT_MS);
    return port;
  } catch (error) {
    console.warn("[gateway-ui] runtime attach failed", error);
    window.setTimeout(() => dismissBootSplash(), 350);
    return null;
  }
}

function identitySummary() {
  const identity = runtimeSnapshot?.shell?.identity || {};
  const linked = Boolean(identity?.linked);
  const identityId = String(identity?.identityId || "").trim();
  const label = linked ? labelForIdentity(identityId) : "@unlinked";
  return { linked, identityId, label };
}

function setConnectionSummaryFromSnapshot() {
  const shellState = runtimeSnapshot?.shell || {};
  const connection = shellState?.connection || {};
  const relay = shellState?.relay || {};
  const ownedGateway = shellState?.ownedGateway || {};
  const services = shellState?.services || {};
  const identity = identitySummary();

  identityHandleEl.textContent = identity.linked ? labelForIdentity(identity.identityId) : "@unlinked";
  identityHandleEl.classList.toggle("identityHandle-linked", identity.linked);
  identityHandleEl.classList.toggle("identityHandle-unlinked", !identity.linked);
  identityHandleEl.title = identity.identityId ? "Open account center" : "Identity not linked yet";

  const connectionLabel = String(connection?.label || "Offline").trim() || "Offline";
  setConnectionStateText(connStateTextEl, {
    label: connectionLabel,
    toneClass: connectionToneClass(String(connection?.code || "").trim().toLowerCase()),
  });
  popConnectionEl.textContent = connectionLabel;
  popRelayEl.textContent = String(relay?.state || "offline");
  popGatewayEl.textContent = String(ownedGateway?.state || "unknown");
  popServicesEl.textContent = String(services?.state || "unknown");
  popConnectionReasonEl.textContent = String(connection?.reason || "Waiting for account runtime.");
}

function connectionToneClass(code) {
  if (code === "connected" || code === "healthy") return "connStateText-connected";
  if (code === "connected-limited" || code === "degraded" || code === "connecting") return "connStateText-limited";
  return "connStateText-offline";
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

function normalizeRecords(snapshot) {
  const managed = snapshot?.managedAppliances || {};
  const buckets = [
    { scope: "owned", items: normalizedArray(managed?.owned) },
    { scope: "shared", items: normalizedArray(managed?.granted) },
    { scope: "discoverable", items: normalizedArray(managed?.discoverable) },
  ];
  const out = [];
  const seen = new Set();
  for (const bucket of buckets) {
    for (const raw of bucket.items) {
      if (!raw || typeof raw !== "object") continue;
      const key = `${bucket.scope}:${String(raw.devicePk || raw.pk || raw.hostGatewayPk || raw.service || "").trim()}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...raw,
        __scope: bucket.scope,
      });
    }
  }
  return out;
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
  return records.find((record) => {
    if (!isServiceRecord(record)) return false;
    if (normalizeRole(record?.service || "") !== "nvr") return false;
    return String(record?.hostGatewayPk || record?.host_gateway_pk || "").trim() === gatewayPk;
  }) || null;
}

function gatewayReportsNvrService(gatewayRecord) {
  return normalizedArray(gatewayRecord?.hostedServices || gatewayRecord?.hosted_services)
    .some((service) => normalizeRole(service?.service || service?.slug || service?.name || service) === "nvr");
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
  const label = value === "owned" ? "Owned" : (value === "shared" ? "Shared" : "Discoverable");
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
    const row = document.createElement("article");
    row.className = "gatewayListItem";
    row.innerHTML = `
      <div class="gatewayListHeader">
        <div>
          <h3 class="gatewayListTitle">${escapeHtml(gatewayTitle(record))}</h3>
          <div class="gatewayListMeta">
            <div>id ${escapeHtml(shortPk(gatewayPk))}</div>
            <div>freshness ${escapeHtml(freshnessLabel(record))}</div>
            <div>service count ${escapeHtml(String(normalizedArray(record?.hostedServices || record?.hosted_services).length || 0))}</div>
          </div>
        </div>
        ${scopePill(record.__scope)}
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "gatewayActionStrip";

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
      void requestZoneSync(record);
    });
    actions.appendChild(zoneSyncButton);

    row.appendChild(actions);
    gatewayListEl.appendChild(row);
  }
}

function renderServiceList(records) {
  serviceListEl.innerHTML = "";
  const services = records.filter((record) => isServiceRecord(record));
  serviceStatusEl.textContent = services.length > 0
    ? `${services.length} hosted service${services.length === 1 ? "" : "s"} in the shared runtime projection.`
    : "No hosted services are currently projected.";
  if (services.length === 0) {
    serviceListEl.innerHTML = `<article class="gatewayEmpty">No hosted services are currently projected.</article>`;
    return;
  }
  for (const record of services) {
    const servicePk = String(record?.devicePk || record?.pk || "").trim();
    const row = document.createElement("article");
    row.className = "gatewayListItem";
    row.innerHTML = `
      <div class="gatewayListHeader">
        <div>
          <h3 class="gatewayListTitle">${escapeHtml(serviceTitle(record))}</h3>
          <div class="gatewayListMeta">
            <div>id ${escapeHtml(shortPk(servicePk))}</div>
            <div>service ${escapeHtml(normalizeRole(record?.service || "") || "unknown")}</div>
            <div>host gateway ${escapeHtml(shortPk(record?.hostGatewayPk || record?.host_gateway_pk || ""))}</div>
            <div>freshness ${escapeHtml(freshnessLabel(record))}</div>
          </div>
        </div>
        ${scopePill(record.__scope)}
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "gatewayActionStrip";
    actions.appendChild(actionButton("Open Live", () => {
      void openSecurityCameras(record, {});
    }));
    actions.appendChild(actionButton("Open Settings", () => {
      void openSecurityCameras(record, { activity: "settings" });
    }));
    row.appendChild(actions);
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
  const shellState = runtimeSnapshot?.shell || {};
  const connection = shellState?.connection || {};
  const relay = shellState?.relay || {};
  const services = shellState?.services || {};
  renderRows(networkSummaryEl, [
    { label: "Connection", value: String(connection?.label || "Offline"), tone: toneForLabel(connection?.label) },
    { label: "Relay", value: String(relay?.state || "offline"), tone: toneForLabel(relay?.state) },
    { label: "Services", value: String(services?.state || "unknown"), tone: toneForLabel(services?.state) },
  ]);
  renderRows(zonesSummaryEl, [
    { label: "Identity authority", value: identitySummary().linked ? "Linked" : "Unlinked", tone: identitySummary().linked ? "good" : "warn" },
    { label: "Runtime snapshot age", value: formatAge(runtimeSnapshot?.updatedAt), tone: "neutral" },
  ]);
}

function renderSecurityView(records) {
  renderRows(securitySummaryEl, [
    { label: "Current posture", value: "Shared chrome active; cybersecurity service not yet projected.", tone: "warn" },
    { label: "Future authority", value: "constitute-cybersec", tone: "neutral" },
  ]);
}

function renderRuntimeView(records) {
  const issue = runtimeSnapshot?.managedServiceIssue || null;
  renderRows(runtimeSummaryEl, [
    { label: "Runtime build", value: String(runtimeSnapshot?.buildId || RUNTIME_WORKER_BUILD_ID), tone: "neutral" },
    { label: "Snapshot age", value: formatAge(runtimeSnapshot?.updatedAt), tone: "neutral" },
    { label: "Projected records", value: String(records.length), tone: "neutral" },
  ]);
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
  if (raw.includes("connected") || raw.includes("live") || raw.includes("open") || raw === "linked") return "good";
  if (raw.includes("offline") || raw.includes("error") || raw.includes("failed") || raw.includes("unlinked")) return "bad";
  if (raw.includes("loading") || raw.includes("unknown") || raw.includes("stale")) return "warn";
  return "neutral";
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
  setConnectionSummaryFromSnapshot();
  const records = normalizeRecords(runtimeSnapshot);
  renderGatewayList(records);
  renderServiceList(records);
  renderNetworkView(records);
  renderSecurityView(records);
  renderRuntimeView(records);
  renderAccountCenter();
}

function renderAccountCenter() {
  const identity = identitySummary();
  const connection = String(connStateTextEl.textContent || "Offline").trim() || "Offline";
  renderAccountCenterSummary(accountCenterSummaryEl, {
    handle: identity.identityId ? labelForIdentity(identity.identityId) : "@unlinked",
    linked: Boolean(identity.identityId),
    connectionLabel: connection,
    connectionToneClass: connectionToneClass(String(runtimeSnapshot?.shell?.connection?.code || "").trim().toLowerCase()),
  });
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
    {
      id: "account.open_gateways",
      label: "Open Gateways",
      onSelect: () => {
        closeAccountCenter();
        closeDrawer();
        setActivity("gateways");
      },
    },
    {
      id: "account.open_services",
      label: "Open Hosted Services",
      onSelect: () => {
        closeAccountCenter();
        closeDrawer();
        setActivity("services");
      },
    },
    {
      id: "account.copy_identity",
      label: "Copy Identity ID",
      disabled: !identity.identityId,
      onSelect: () => {
        closeAccountCenter();
        if (!identity.identityId) return;
        void navigator.clipboard.writeText(identity.identityId).then(() => {
          addNotification("good", "Identity copied", "Copied linked identity ID.");
        }).catch((error) => {
          addNotification("bad", "Identity copy failed", String(error?.message || error));
        });
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
  try {
    const access = await runtimeBrokerCall(BROKER.SERVICE_ACCESS_REQUEST, {
      payload: {
        record,
        options: {
          service: "nvr",
          capability: "nvr.view",
        },
      },
    }, GATEWAY_ACTION_TIMEOUT_MS, "service access");
    const contextId = randomOpaqueId("service-access");
    const context = {
      contextId,
      app: "nvr",
      repo: "constitute-nvr-ui",
      identityId: String(runtimeSnapshot?.shell?.identity?.identityId || "").trim(),
      devicePk: String(access?.servicePk || record?.devicePk || record?.pk || "").trim(),
      gatewayPk: String(access?.gatewayPk || record?.hostGatewayPk || record?.devicePk || record?.pk || "").trim(),
      servicePk: String(access?.servicePk || record?.devicePk || record?.pk || "").trim(),
      service: "nvr",
      serviceCapability: String(access?.serviceCapability || "").trim(),
      display: access?.display ?? {},
      createdAt: Date.now(),
      expiresAt: Number(access?.expiresAt || (Date.now() + (2 * 60 * 1000))),
    };
    await runtimeCall(BROKER.SERVICE_ACCESS_CONTEXT_PUT, { context }, RUNTIME_WRITE_TIMEOUT_MS);
    const url = buildManagedSurfaceUrl("constitute-nvr-ui", contextId, opts);
    window.open(url, "_blank", "noopener,noreferrer");
    addNotification("good", "Security Cameras opened", "Managed service access context was published to the shared runtime.");
  } catch (error) {
    addNotification("bad", "Security Cameras service access failed", String(error?.message || error));
  }
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

async function requestZoneSync(record) {
  const gatewayPk = String(record?.devicePk || record?.pk || "").trim();
  const existing = extraZonesForGateway(gatewayPk);
  const entered = window.prompt(
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

function buildManagedSurfaceUrl(repo, contextId, opts = {}) {
  const target = new URL(`/${String(repo || "").trim()}/`, window.location.origin);
  const params = new URLSearchParams();
  params.set("serviceAccess", String(contextId || "").trim());
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
