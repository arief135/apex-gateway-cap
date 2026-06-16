import cds from '@sap/cds';
import http, { type IncomingHttpHeaders, type RequestOptions } from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import type { Readable } from 'node:stream';
import type { Application, Request, Response } from 'express';

const log = cds.log('gateway-proxy');

type Route = {
    ID: string;
    name?: string;
    pathPattern: string;
    allowedMethods?: string[] | null;
    destination_ID: string;
    status?: 'active' | 'inactive';
    logPayload?: boolean;
    timeoutMs?: number;
    requestTransform?: string | null;
    responseTransform?: string | null;
};

type Destination = {
    ID: string;
    name?: string;
    url: string;
    protocol?: string;
    absolute?: boolean;
    method: string;
    headers?: string | null;
    stripPrefix?: string | null;
    status?: 'active' | 'inactive';
    authMethod_ID?: string | null;
};

type AuthMethod = {
    ID: string;
    type?: 'none' | 'basic' | 'apiKey' | 'oauth2' | 'bearer';
    username?: string | null;
    password?: string | null;
    keyName?: string | null;
    keyValue?: string | null;
    keyIn?: string | null;
    clientId?: string | null;
    clientSecret?: string | null;
    tokenUrl?: string | null;
    token?: string | null;
};

// Convert a route pathPattern into a RegExp.
//   *        — matches a single path segment
//   **       — matches any number of segments
//   :param   — matches a single segment
function patternToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, ' DS ')
        .replace(/\*/g, '[^/]*')
        .replace(/ DS /g, '.*')
        .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '[^/]+');
    return new RegExp(`^${escaped}/?$`);
}

function matchRoute(routes: Route[], path: string): Route | undefined {
    return routes.find((r) => {
        if (!r.pathPattern) return false;
        if (r.pathPattern === path) return true;
        try {
            return patternToRegex(r.pathPattern).test(path);
        } catch {
            return false;
        }
    });
}

function parseHeaders(raw: string | null | undefined): Record<string, string> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch (e) {
        log.warn('Invalid destination.headers JSON; ignoring.', (e as Error).message);
        return {};
    }
}

function bufferStream(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

type TransformContext = Record<string, unknown>;

function executeScript(script: string, context: TransformContext, timeoutMs = 200): TransformContext {
    const ctx = vm.createContext({ ...context });
    try {
        vm.runInContext(`(function(){ ${script} })()`, ctx, { timeout: timeoutMs });
    } catch (err) {
        log.warn('Transform script error — forwarding with original context.', (err as Error).message);
        return context;
    }
    return ctx as TransformContext;
}

function buildTargetUrl(destination: Destination, incomingPath: string, queryString: string): string {
    if (destination.absolute) {
        return destination.url + (queryString || '');
    }
    let suffix = incomingPath;
    const strip = destination.stripPrefix || '';
    if (strip && suffix.startsWith(strip)) {
        suffix = suffix.slice(strip.length) || '/';
    }
    if (!suffix.startsWith('/')) suffix = '/' + suffix;
    const base = destination.url.replace(/\/$/, '');
    return base + suffix + (queryString || '');
}

function forward(
    req: Request,
    res: Response,
    targetUrl: string,
    extraHeaders: Record<string, string>,
    timeoutMs?: number,
    overrideBody?: Buffer | null,
    responseTransform?: string | null,
): Promise<void> {
    return new Promise((resolve) => {
        let url: URL;
        try {
            url = new URL(targetUrl);
        } catch (e) {
            res.status(502).json({ error: 'Invalid destination url', detail: (e as Error).message });
            return resolve();
        }
        const client = url.protocol === 'https:' ? https : http;

        const headers: IncomingHttpHeaders = { ...req.headers, ...extraHeaders };
        delete headers.host;
        delete headers['content-length'];
        delete headers.connection;

        if (overrideBody != null) {
            headers['content-length'] = String(overrideBody.length);
        }

        const options: RequestOptions = {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: req.method,
            headers,
        };
        if (timeoutMs && timeoutMs > 0) options.timeout = timeoutMs;

        const proxyReq = client.request(options, async (proxyRes) => {
            if (responseTransform) {
                try {
                    const rawBuf = await bufferStream(proxyRes);
                    const rawStr = rawBuf.toString('utf8');
                    const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
                    let body: unknown = rawStr;
                    if (contentType.includes('application/json')) {
                        try { body = JSON.parse(rawStr); } catch { /* keep raw string */ }
                    }

                    const resHeaders: Record<string, string | string[]> = {};
                    for (const [k, v] of Object.entries(proxyRes.headers)) {
                        if (v !== undefined) resHeaders[k] = v;
                    }

                    const ctx = executeScript(responseTransform, {
                        headers: resHeaders,
                        body,
                        status: proxyRes.statusCode ?? 502,
                    });

                    const newStatus = typeof ctx.status === 'number' ? ctx.status : (proxyRes.statusCode ?? 502);
                    const newHeaders = ctx.headers as Record<string, string | string[]>;
                    const newBodyStr =
                        typeof ctx.body === 'object' && ctx.body !== null
                            ? JSON.stringify(ctx.body)
                            : String(ctx.body ?? '');
                    const newBodyBuf = Buffer.from(newBodyStr, 'utf8');

                    res.status(newStatus);
                    for (const [k, v] of Object.entries(newHeaders)) {
                        if (k.toLowerCase() === 'content-length') continue;
                        if (v !== undefined) res.setHeader(k, v);
                    }
                    res.setHeader('content-length', String(newBodyBuf.length));
                    res.end(newBodyBuf);
                } catch (err) {
                    log.error('Response transform failed', (err as Error).message);
                    if (!res.headersSent) res.status(502).json({ error: 'Response transform failed' });
                }
                return resolve();
            }

            res.status(proxyRes.statusCode || 502);
            for (const [k, v] of Object.entries(proxyRes.headers)) {
                if (v !== undefined) res.setHeader(k, v);
            }
            proxyRes.pipe(res);
            proxyRes.on('end', () => resolve());
            proxyRes.on('error', () => resolve());
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy(new Error('timeout'));
            if (!res.headersSent) res.status(504).json({ error: 'Gateway timeout' });
            resolve();
        });

        proxyReq.on('error', (err: Error) => {
            if (!res.headersSent) res.status(502).json({ error: 'Bad gateway', detail: err.message });
            resolve();
        });

        if (overrideBody != null) {
            proxyReq.end(overrideBody);
        } else {
            req.pipe(proxyReq);
        }
    });
}

type ResolvedRequest = {
    incomingPath: string;
    queryRaw: string;
    queryString: string;
    queryObj: Record<string, string>;
    rawBuf: Buffer;
    incomingBody: unknown;
    matched: Route;
    destination: Destination;
    finalTargetUrl: string;
    finalExtraHeaders: Record<string, string>;
    overrideBody: Buffer;
    finalBody: unknown;
    requestTransformApplied: boolean;
};

async function resolveRequest(req: Request, res: Response): Promise<ResolvedRequest | null> {
    const { Routes, Destinations } = cds.entities('apex.gateway');

    const [pathOnly, queryRaw] = (req.url || '/').split('?');
    const queryString = queryRaw ? '?' + queryRaw : '';
    const incomingPath = pathOnly || '/';

    if (incomingPath === '/') {
        res.status(400).json({ error: 'Empty route', path: incomingPath, method: req.method });
        return null;
    }

    // Always buffer the incoming body — needed for transforms and inspection
    const rawBuf = await bufferStream(req);
    const rawStr = rawBuf.toString('utf8');
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    let incomingBody: unknown = rawStr || null;
    if (contentType.includes('application/json') && rawStr.trim()) {
        try { incomingBody = JSON.parse(rawStr); } catch { /* keep raw string */ }
    }

    const queryObj: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(queryRaw || '')) queryObj[k] = v;

    const routes = (await SELECT.from(Routes).where({ status: 'active' })) as Route[];
    const matched = matchRoute(routes, incomingPath);

    if (!matched) {
        res.status(404).json({ error: 'No matching route', path: incomingPath, method: req.method });
        return null;
    }

    const allowed = Array.isArray(matched.allowedMethods) ? matched.allowedMethods : [];
    if (allowed.length > 0 && req.method && !allowed.includes(req.method)) {
        res.setHeader('Allow', allowed.join(', '));
        res.status(405).json({ error: 'Method not allowed', allowed, method: req.method });
        return null;
    }

    const destination = (await SELECT.one
        .from(Destinations)
        .where({ ID: matched.destination_ID })) as Destination | null;

    if (!destination) {
        res.status(503).json({ error: 'Destination not found' });
        return null;
    }
    if (destination.status && destination.status !== 'active') {
        res.status(503).json({ error: 'Destination inactive' });
        return null;
    }
    if (!destination.url) {
        res.status(503).json({ error: 'Destination url missing' });
        return null;
    }

    const targetUrl = buildTargetUrl(destination, incomingPath, queryString);
    const extraHeaders = parseHeaders(destination.headers);

    let finalTargetUrl = targetUrl;
    let finalExtraHeaders: Record<string, string> = extraHeaders;
    let finalBody: unknown = incomingBody;
    let overrideBody: Buffer = rawBuf;
    let requestTransformApplied = false;

    if (matched.requestTransform) {
        requestTransformApplied = true;

        const reqHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries({ ...req.headers, ...extraHeaders })) {
            if (typeof v === 'string') reqHeaders[k] = v;
            else if (Array.isArray(v)) reqHeaders[k] = v.join(', ');
        }

        const ctx = executeScript(matched.requestTransform, {
            headers: reqHeaders,
            body: incomingBody,
            query: { ...queryObj },
            path: incomingPath,
            method: req.method,
        });

        const newBodyStr =
            typeof ctx.body === 'object' && ctx.body !== null
                ? JSON.stringify(ctx.body)
                : String(ctx.body ?? rawStr);
        overrideBody = Buffer.from(newBodyStr, 'utf8');
        finalBody = ctx.body;

        const newQuery = ctx.query as Record<string, string>;
        const newSearchParams = new URLSearchParams(newQuery).toString();
        const newQs = newSearchParams ? '?' + newSearchParams : '';
        finalTargetUrl = buildTargetUrl(destination, incomingPath, newQs);
        finalExtraHeaders = ctx.headers as Record<string, string>;
    }

    return {
        incomingPath,
        queryRaw: queryRaw || '',
        queryString,
        queryObj,
        rawBuf,
        incomingBody,
        matched,
        destination,
        finalTargetUrl,
        finalExtraHeaders,
        overrideBody,
        finalBody,
        requestTransformApplied,
    };
}

cds.on('bootstrap', (app: Application) => {

    // read environment variable to decide whether to serve the admin UI or not
    if (process.env.NODE_ENV == 'production') {
        app.get('/', (_req: Request, res: Response) => {
            res.sendFile(path.join(cds.root, 'app', 'admin_ui', 'index.html'));
        });
    }

    app.use('/test-api', async (req: Request, res: Response) => {
        try {
            const { AuthMethods } = cds.entities('apex.gateway');

            const resolved = await resolveRequest(req, res);
            if (!resolved) return;

            const { incomingPath, queryObj, matched, destination, finalTargetUrl, finalExtraHeaders, overrideBody, finalBody, requestTransformApplied } = resolved;

            const authMethod = destination.authMethod_ID
                ? ((await SELECT.one.from(AuthMethods).where({ ID: destination.authMethod_ID })) as unknown as AuthMethod | null)
                : null;

            const targetMethod = destination.absolute ? destination.method : req.method;

            // Build headers exactly as forward() would — merge, strip hop-by-hop, add content-length
            const forwardHeaders: Record<string, string | string[] | undefined> = {
                ...req.headers,
                ...finalExtraHeaders,
            };
            delete forwardHeaders.host;
            delete forwardHeaders['content-length'];
            delete forwardHeaders.connection;
            if (overrideBody.length > 0) {
                forwardHeaders['content-length'] = String(overrideBody.length);
            }

            res.status(200).json({
                incoming: {
                    method: req.method,
                    path: incomingPath,
                    query: queryObj,
                    headers: req.headers,
                    body: resolved.incomingBody,
                },
                matched: {
                    route: {
                        id: matched.ID,
                        name: matched.name,
                        pathPattern: matched.pathPattern,
                        allowedMethods: matched.allowedMethods,
                        status: matched.status,
                        logPayload: matched.logPayload,
                        timeoutMs: matched.timeoutMs,
                        requestTransform: matched.requestTransform ?? null,
                        responseTransform: matched.responseTransform ?? null,
                    },
                    destination: {
                        id: destination.ID,
                        name: destination.name,
                        url: destination.url,
                        protocol: destination.protocol,
                        absolute: destination.absolute,
                        method: destination.method,
                        stripPrefix: destination.stripPrefix,
                        status: destination.status,
                        headers: parseHeaders(destination.headers),
                    },
                    authMethod: authMethod ?? null,
                },
                forwarded: {
                    targetUrl: finalTargetUrl,
                    method: targetMethod,
                    headers: forwardHeaders,
                    body: finalBody,
                    requestTransformApplied,
                    responseTransformPresent: !!matched.responseTransform,
                    timeoutMs: matched.timeoutMs ?? null,
                },
            });
        } catch (err) {
            log.error(err);
            if (!res.headersSent) res.status(500).json({ error: (err as Error).message });
        }
    });

    app.use('/api', async (req: Request, res: Response) => {
        try {
            const resolved = await resolveRequest(req, res);
            if (!resolved) return;

            const { matched, destination, finalTargetUrl, finalExtraHeaders, overrideBody } = resolved;

            if (matched.logPayload) {
                log.info(`${req.method} ${req.originalUrl} -> ${finalTargetUrl}`, {
                    route: matched.name,
                    destination: destination.name,
                });
            }

            await forward(req, res, finalTargetUrl, finalExtraHeaders, matched.timeoutMs, overrideBody, matched.responseTransform);
        } catch (err) {
            log.error(err);
            if (!res.headersSent) res.status(500).json({ error: (err as Error).message });
        }
    });
});

export default cds.server;
