# Gateway UI Architecture

## Current
- `constitute-gateway-ui` is the browser control surface for gateway management.
- It consumes runtime state from `constitute-account/runtime.worker.js`.
- It renders shared chrome and primitives from `constitute-ui`.
- It consumes service-access/broker constants from `constitute-protocol`.
- Direct entry is canonical; users should not need to visit `constitute-account` manually before the gateway surface can resolve account/session/grant state.
- It attaches to the account runtime as an ES module SharedWorker with the same versioned URL and `constitute-account-runtime-${runtimeBuildId}` name used by the account bridge.

## Service Access
- Opening hosted services requests `gateway.serviceAccess.request` through the shared runtime.
- Gateway UI stores `ServiceAccessContext` in runtime state and opens app URLs with a non-secret `serviceAccess` context id.
- `serviceCapability` is opaque browser-carried CAAC material; Gateway UI does not inspect decrypted capability claims.
- Opening Logging uses runtime service access and retained projection semantics; it does not pass raw logging API URLs to the app.

## Hosted Services
- Hosted Services is the installed-service inventory for a gateway host.
- The section focuses on service health, freshness, version, host gateway, and configuration posture.
- Launch actions are optional and service-specific; NVR exposes Security Cameras actions, while storage can appear as a non-launcher service with health/config facts.
- Logging appears as an installed hosted service with health/config facts and an optional open action for `constitute-logging-ui`.
- The Logging open action launches the app surface only; log data arrives through account-runtime projections requested by generic service exchange and routed/attested by gateway.
- Gateway UI should merge standalone service records and gateway `hostedServices` summaries into one installed-service view without duplicating rows.

## Planned
- `constitute-service-manager` will project host/service lifecycle, configuration, deployment, and authorized remediation state into this surface later.
- `constitute-cybersec` will project deeper host capability state into this surface later.
- Gateway UI should surface host/service posture, while implementation remains in dedicated capability services. Gateway UI must not become the service manager, firewall console, log interpreter, or security analyzer.
- `constitute-physec` is a future app surface for Physical Security and should consume gateway/NVR/Zigbee projections rather than live inside Gateway UI.

## Retired
- Gateway management living inside the `constitute` account shell is retired.
