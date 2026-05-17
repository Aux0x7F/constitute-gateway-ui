# constitute-gateway-ui

`constitute-gateway-ui` is the browser management surface for gateway state.

It presents gateway inventory, hosted-service posture, swarm edge state, network
posture, and operator controls that belong in the browser rather than in the
native gateway process.

It renders gateway/runtime read models and submits narrow operator intents. It
does not mint service membership, route truth, or hosted-service health from
app-local fallback state.
