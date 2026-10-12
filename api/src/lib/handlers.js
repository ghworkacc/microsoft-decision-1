import { clientKey } from './clientIp.js';

export const MAX_BODY_BYTES = 64 * 1024;
const FOUNDRY_TIMEOUT_MS = 30_000;

function json(status, body, headers = {}) {
    return { status, jsonBody: body, headers };
}

function failure(status, code, message, extra = {}) {
    return json(status, { error: { code, message }, ...extra });
}

function rateLimitHeaders(rate) {
    return {
        'RateLimit-Limit': String(rate.limit),
        'RateLimit-Remaining': String(rate.remaining),
        'RateLimit-Reset': String(rate.resetSeconds),
    };
}

// App Service CORS can't expose custom headers, so the browser reads the quota
// from the JSON body; the headers are for everyone else.
function rateLimitBody({ limit, remaining, resetSeconds }) {
    return { limit, remaining, resetSeconds };
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function disabled() {
    return failure(404, 'AnonymousModeDisabled', 'Anonymous access is not enabled.');
}

async function readJsonBody(request) {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) return { error: tooLarge() };
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return { error: tooLarge() };
    try {
        return { body: JSON.parse(text) };
    } catch {
        return { error: failure(400, 'InvalidJson', 'Request body must be JSON.') };
    }
}

function tooLarge() {
    return failure(413, 'PayloadTooLarge', `Request body must be at most ${MAX_BODY_BYTES} bytes.`);
}

export function createHandlers({ settings, rateLimiter, getAccessToken, fetchImpl = fetch }) {
    async function quota(request, context) {
        if (!settings.anonymousMode) return disabled();
        try {
            const rate = await rateLimiter.peek(clientKey(request.headers));
            return json(200, { rateLimit: rateLimitBody(rate) }, rateLimitHeaders(rate));
        } catch (error) {
            context.error('Rate limit lookup failed', error);
            return failure(503, 'RateLimiterUnavailable', 'Try again shortly.');
        }
    }

    async function decision(request, context) {
        if (!settings.anonymousMode) return disabled();

        const { body, error } = await readJsonBody(request);
        if (error) return error;
        if (
            !isPlainObject(body) ||
            typeof body.state !== 'string' ||
            !isPlainObject(body.questions)
        ) {
            return failure(
                400,
                'InvalidRequest',
                'Expected { "state": string, "questions": object }.',
            );
        }

        let rate;
        try {
            rate = await rateLimiter.consume(clientKey(request.headers));
        } catch (cause) {
            // Fail closed: without a working counter we can't enforce the cap.
            context.error('Rate limit update failed', cause);
            return failure(503, 'RateLimiterUnavailable', 'Try again shortly.');
        }

        const headers = rateLimitHeaders(rate);
        const rateLimit = rateLimitBody(rate);
        if (!rate.allowed) {
            return json(
                429,
                {
                    error: {
                        code: 'RateLimited',
                        message: `Anonymous use is limited to ${rate.limit} requests per minute. Try again in ${rate.resetSeconds} seconds.`,
                    },
                    rateLimit,
                },
                { ...headers, 'Retry-After': String(rate.resetSeconds) },
            );
        }

        let upstream;
        let payload;
        try {
            const accessToken = await getAccessToken();
            upstream = await fetchImpl(
                `${settings.foundryEndpoint}/providers/microsoft/v1/systemone`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    // Only forward known fields, and always the configured model.
                    body: JSON.stringify({
                        model: settings.deploymentName,
                        state: body.state,
                        questions: body.questions,
                    }),
                    signal: AbortSignal.timeout(FOUNDRY_TIMEOUT_MS),
                },
            );
            payload = await upstream.json();
        } catch (cause) {
            context.error('Foundry call failed', cause);
            return json(
                502,
                {
                    error: {
                        code: 'BadGateway',
                        message: 'The decision model could not be reached.',
                    },
                    rateLimit,
                },
                headers,
            );
        }

        if (!isPlainObject(payload)) {
            return json(
                502,
                {
                    error: {
                        code: 'BadGateway',
                        message: 'The decision model returned an unexpected response.',
                    },
                    rateLimit,
                },
                headers,
            );
        }
        return json(upstream.status, { ...payload, rateLimit }, headers);
    }

    return { quota, decision };
}
