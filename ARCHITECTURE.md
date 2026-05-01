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

## Planned
- `constitute-logging`, `constitute-cybersec`, and `constitute-storage` will project deeper host capability state into this surface later.
- Gateway UI should surface those capabilities as host/service posture, while implementation remains in dedicated capability services.
- `constitute-physec` is a future app surface for Physical Security and should consume gateway/NVR/Zigbee projections rather than live inside Gateway UI.

## Retired
- Gateway management living inside the `constitute` account shell is retired.
