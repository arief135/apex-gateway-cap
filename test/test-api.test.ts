/**
 * Integration tests for the /test-api inspection endpoint.
 *
 * The server is started once per file using cds.test() which wires up
 * beforeAll / afterAll automatically.  Each test inserts its own Destination
 * and Route (distinct path patterns) and resets the database before every
 * test so CSV seed data never interferes.
 *
 * NOTE: allowedMethods is stored as a plain String column in the schema
 * (e.g. '["GET"]').  At runtime, Array.isArray() returns false for that
 * string, so the 405 guard in resolveRequest() is effectively bypassed —
 * test #3 documents this behaviour.
 */
import cds from '@sap/cds';
// Side-effect import: registers cds.on('bootstrap', ...) from server.ts before the
// test server starts. cds.test() may not auto-load srv/server.ts in the vitest worker
// context (tsx loader hooks are not always active), so we ensure it ourselves.
import '../srv/server';
import { describe, it, beforeEach, expect } from 'vitest';

// Force SQLite in-memory (--in-memory ignores the project's cds.requires.db Postgres
// config) so tests run in isolation and do not touch the real database.
const { GET, POST, data } = cds.test('serve', 'all', '--in-memory').in(__dirname + '/..');

// ── helpers ──────────────────────────────────────────────────────────────────

function destID(suffix: string) {
    // Deterministic but collision-free UUIDs for each test.
    return `00000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
}

function routeID(suffix: string) {
    return `11111111-1111-1111-1111-${suffix.padStart(12, '0')}`;
}

async function insertDestination(id: string, overrides: Record<string, unknown> = {}) {
    const { Destinations } = cds.entities('apex.gateway');
    await INSERT.into(Destinations).entries({
        ID: id,
        name: `dest-${id}`,
        url: 'http://example.com',
        protocol: 'HTTP',
        absolute: false,
        method: 'GET',
        headers: '{}',
        stripPrefix: '',
        status: 'active',
        ...overrides,
    });
}

async function insertRoute(
    id: string,
    pathPattern: string,
    destination_ID: string,
    overrides: Record<string, unknown> = {},
) {
    const { Routes } = cds.entities('apex.gateway');
    await INSERT.into(Routes).entries({
        ID: id,
        name: `route-${id}`,
        pathPattern,
        allowedMethods: '[]',
        destination_ID,
        status: 'active',
        syncMode: 'sync',
        logPayload: false,
        rateLimit: 0,
        timeoutMs: 0,
        ...overrides,
    });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('/test-api endpoint', () => {
    beforeEach(data.reset);

    // ── 1. Empty / root path returns 400 ─────────────────────────────────────
    it('returns 400 for empty (root) path', async () => {
        const res = await GET('/test-api/', { validateStatus: () => true });
        expect(res.status).toBe(400);
        expect(res.data.error).toBe('Empty route');
    });

    // ── 2. Unknown path with no matching route returns 404 ───────────────────
    it('returns 404 when no route matches', async () => {
        const res = await GET('/test-api/no-such-path', { validateStatus: () => true });
        expect(res.status).toBe(404);
        expect(res.data.error).toBe('No matching route');
    });

    // ── 3. allowedMethods column is plain String — 405 guard is not triggered ─
    it('does NOT return 405 because allowedMethods is stored as a String, not an array', async () => {
        const dId = destID('000000000003');
        const rId = routeID('000000000003');
        await insertDestination(dId);
        // Store as a JSON-array string — this is what the DB actually holds.
        await insertRoute(rId, '/test-method-guard', dId, {
            allowedMethods: '["GET"]',
        });

        // Even though we POST and the route "says" GET only, Array.isArray('["GET"]')
        // is false so the guard never fires → the request resolves normally (200).
        const res = await POST('/test-api/test-method-guard', {}, { validateStatus: () => true });
        // Documents current behaviour: no 405, falls through to 200.
        expect(res.status).toBe(200);
    });

    // ── 4. Route pointing to non-existent destination returns 503 ────────────
    it('returns 503 when destination is not found', async () => {
        const rId = routeID('000000000004');
        const { Routes } = cds.entities('apex.gateway');
        await INSERT.into(Routes).entries({
            ID: rId,
            name: `route-${rId}`,
            pathPattern: '/test-no-dest',
            allowedMethods: '[]',
            destination_ID: '99999999-9999-9999-9999-999999999999', // does not exist
            status: 'active',
            syncMode: 'sync',
            logPayload: false,
            rateLimit: 0,
            timeoutMs: 0,
        });

        const res = await GET('/test-api/test-no-dest', { validateStatus: () => true });
        expect(res.status).toBe(503);
        expect(res.data.error).toBe('Destination not found');
    });

    // ── 5. Inactive destination returns 503 ──────────────────────────────────
    it('returns 503 for inactive destination', async () => {
        const dId = destID('000000000005');
        const rId = routeID('000000000005');
        await insertDestination(dId, { status: 'inactive' });
        await insertRoute(rId, '/test-inactive-dest', dId);

        const res = await GET('/test-api/test-inactive-dest', { validateStatus: () => true });
        expect(res.status).toBe(503);
        expect(res.data.error).toBe('Destination inactive');
    });

    // ── 6. Happy path — basic inspection ─────────────────────────────────────
    it('returns 200 with full inspection payload for matched route', async () => {
        const dId = destID('000000000006');
        const rId = routeID('000000000006');
        await insertDestination(dId, { url: 'http://example.com' });
        await insertRoute(rId, '/test-products', dId);

        const res = await GET('/test-api/test-products', { validateStatus: () => true });
        expect(res.status).toBe(200);

        const { incoming, matched, forwarded } = res.data;

        // incoming section
        expect(incoming.method).toBe('GET');
        expect(incoming.path).toBe('/test-products');

        // matched section
        expect(matched.route.id).toBe(rId);
        expect(matched.route.pathPattern).toBe('/test-products');
        expect(matched.destination.id).toBe(dId);
        expect(matched.destination.url).toBe('http://example.com');
        expect(matched.destination.status).toBe('active');
        expect(matched.authMethod).toBeNull();

        // forwarded section
        expect(forwarded.targetUrl).toContain('http://example.com');
        expect(forwarded.requestTransformApplied).toBe(false);
        expect(forwarded.responseTransformPresent).toBe(false);
    });

    // ── 7. Query string is preserved and parsed ───────────────────────────────
    it('includes parsed query params and propagates them to targetUrl', async () => {
        const dId = destID('000000000007');
        const rId = routeID('000000000007');
        await insertDestination(dId, { url: 'http://example.com' });
        await insertRoute(rId, '/test-qstring', dId);

        const res = await GET('/test-api/test-qstring?foo=bar&baz=1', { validateStatus: () => true });
        expect(res.status).toBe(200);

        expect(res.data.incoming.query).toMatchObject({ foo: 'bar', baz: '1' });
        expect(res.data.forwarded.targetUrl).toContain('?foo=bar&baz=1');
    });

    // ── 8. Single-segment wildcard pattern `/items/*` ────────────────────────
    it('matches single-segment wildcard /items/*', async () => {
        const dId = destID('000000000008');
        const rId = routeID('000000000008');
        await insertDestination(dId);
        await insertRoute(rId, '/items/*', dId);

        const res = await GET('/test-api/items/42', { validateStatus: () => true });
        expect(res.status).toBe(200);
        expect(res.data.matched.route.pathPattern).toBe('/items/*');
    });

    // ── 9. Double-wildcard pattern `/deep/**` ─────────────────────────────────
    it('matches multi-segment wildcard /deep/**', async () => {
        const dId = destID('000000000009');
        const rId = routeID('000000000009');
        await insertDestination(dId);
        await insertRoute(rId, '/deep/**', dId);

        const res = await GET('/test-api/deep/a/b/c', { validateStatus: () => true });
        expect(res.status).toBe(200);
        expect(res.data.matched.route.pathPattern).toBe('/deep/**');
    });

    // ── 10. Request transform is applied ─────────────────────────────────────
    it('reports requestTransformApplied when route has a requestTransform', async () => {
        const dId = destID('000000000010');
        const rId = routeID('000000000010');
        await insertDestination(dId, { url: 'http://example.com' });
        await insertRoute(rId, '/test-transform', dId, {
            // A trivial transform that just re-sets body to a string.
            requestTransform: "body = 'transformed';",
        });

        const res = await GET('/test-api/test-transform', { validateStatus: () => true });
        expect(res.status).toBe(200);
        expect(res.data.forwarded.requestTransformApplied).toBe(true);
        expect(res.data.forwarded.responseTransformPresent).toBe(false);
    });
});
