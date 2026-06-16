## What's Currently Working
- Route config CRUD (OData + draft)
- Path pattern matching (`*`, `**`, `:param`)
- HTTP method enforcement (405)
- Destination management with `stripPrefix`, `absolute`, extra headers
- Timeout handling (504)
- Basic `logPayload` flag per route
- Auth method **schema** (basic, apiKey, oauth2, bearer)

---

## What's Missing for Enterprise Middleware

### 1. Auth Not Applied in Proxy (Critical)
`AuthMethods` is fully modelled but the `forward()` function never fetches or injects it. Credentials stored in the DB are never used — all backend calls go unauthenticated.

### 2. Rate Limiting Not Enforced
`rateLimit` field exists on `Routes` but is never checked. No in-memory counter, no Redis-backed window, nothing.

### 3. Async Mode Not Implemented
`syncMode` enum is defined as `sync | async` but the proxy handler has no async/queue path — every request is treated as sync.

### 4. Credential Security
Passwords, API keys, OAuth2 client secrets, and bearer tokens are stored **plaintext** in the DB. No encryption at rest, no integration with a secrets vault (SAP Credential Store, HashiCorp Vault, etc.).

### 5. No Authentication on `/api` Itself
Any request hitting `/api/*` is proxied without the gateway validating the **caller's** identity. There's no JWT validation, API key check, or SAP BTP XSUAA integration guarding the gateway entry point.

### 6. No Retry / Circuit Breaker
Transient backend failures return 502 immediately. No retry-with-backoff, no circuit breaker to stop hammering a failing destination.

### 7. No Request/Response Transformation
Beyond `stripPrefix` and static extra headers, there's no:
- Body transformation (JSON reshaping, protocol bridging)
- Response header rewriting
- Path rewriting beyond prefix stripping

### 8. No Distributed Tracing / Correlation IDs
No `X-Request-ID` / `X-Correlation-ID` generation or propagation. Impossible to trace a request end-to-end across services.

### 9. No Metrics / Observability
No structured metrics (request rate, p95 latency, error rate per route/destination). The only observability is `log.info` behind a `logPayload` flag — no integration with Prometheus, Dynatrace, or SAP Cloud Logging.

### 10. No Health Checks for Destinations
Destinations with `status: inactive` are rejected, but status is only changed manually via the UI. There's no automated health probe to mark a destination down and recover it.

### 11. No Response Caching
No `Cache-Control`-aware or TTL-based response caching to reduce backend load.

### 12. No CORS Configuration
The proxy passes through all headers without any configurable CORS policy per route.

### 13. No Load Balancing
Each destination is a single URL. No support for multiple backend instances, round-robin, or weighted routing.

### 14. No Route Versioning / Traffic Splitting
No support for `v1`/`v2` route groups, canary deployments, or percentage-based traffic splitting between destinations.

### 15. Request Size / Payload Validation
No `max-body-size` enforcement per route; a large upload is blindly piped to the backend.

### 16. Audit Log
`managed` aspect gives `createdAt/modifiedAt` on config entities, but there's no log of **who triggered which request**, what it returned, or who changed a route's status.

---

## Priority Order for Enterprise Readiness

| Priority | Gap |
|---|---|
| P0 | Auth applied in proxy + caller authentication on `/api` |
| P0 | Credential encryption |
| P1 | Rate limiting enforcement |
| P1 | Retry + circuit breaker |
| P2 | Correlation ID propagation + structured access logs |
| P2 | Destination health checks |
| P3 | Async mode, caching, load balancing |