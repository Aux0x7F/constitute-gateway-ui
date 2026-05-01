# Gateway UI Architecture

## Current
- `constitute-gateway-ui` is the browser control surface for gateway management.
- It consumes runtime state from `constitute-account/runtime.worker.js`.
- It renders shared chrome and primitives from `constitute-ui`.
- Direct entry is canonical; users should not need to visit `constitute-account` manually before the gateway surface can resolve account/session/grant state.

## Planned
- `constitute-security` and `constitute-storage` will project deeper host capability state into this surface later.
- Gateway UI should surface those capabilities as host/service posture, while implementation remains in dedicated capability services.

## Retired
- Gateway management living inside the `constitute` account shell is retired.
