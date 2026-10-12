import { describe, expect, it, vi } from 'vitest';
import { createHandlers, MAX_BODY_BYTES } from './handlers.js';

const settings = {
    anonymousMode: true,
    foundryEndpoint: 'https://foundry.example',
    deploymentName: 'msft-decision-1',
    rateLimitPerMinute: 5,
};

const validBody = { state: 'Customer: hi', questions: { q1: { type: 'noul' } } };

function request(body, { method = 'POST', forwardedFor = '203.0.113.7:1234', headers = {} } = {}) {
    return new Request('https://func.example/api/decision', {
        method,
        headers: {
            'x-forwarded-for': forwardedFor,
            'content-type': 'application/json',
            ...headers,
        },
        body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
}

const context = { error: vi.fn() };

function setup({ overrides = {}, consume, peek, fetchImpl } = {}) {
    const rateLimiter = {
        consume: vi.fn(
            consume ?? (async () => ({ allowed: true, limit: 5, remaining: 4, resetSeconds: 42 })),
        ),
        peek: vi.fn(peek ?? (async () => ({ limit: 5, remaining: 3, resetSeconds: 17 }))),
    };
    const fetchMock = vi.fn(
        fetchImpl ??
            (async () =>
                new Response(JSON.stringify({ q1: { output: 'True' } }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })),
    );
    const handlers = createHandlers({
        settings: { ...settings, ...overrides },
        rateLimiter,
        getAccessToken: async () => 'token-123',
        fetchImpl: fetchMock,
    });
    return { ...handlers, rateLimiter, fetchMock };
}

describe('when anonymous mode is disabled', () => {
    it('refuses both endpoints without touching the counter', async () => {
        const { quota, decision, rateLimiter, fetchMock } = setup({
            overrides: { anonymousMode: false },
        });
        for (const response of [
            await quota(request(undefined, { method: 'GET' }), context),
            await decision(request(validBody), context),
        ]) {
            expect(response.status).toBe(404);
            expect(response.jsonBody.error.code).toBe('AnonymousModeDisabled');
        }
        expect(rateLimiter.peek).not.toHaveBeenCalled();
        expect(rateLimiter.consume).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('quota', () => {
    it('reports the caller quota without consuming it', async () => {
        const { quota, rateLimiter } = setup();
        const response = await quota(request(undefined, { method: 'GET' }), context);
        expect(response.status).toBe(200);
        expect(response.jsonBody).toEqual({
            rateLimit: { limit: 5, remaining: 3, resetSeconds: 17 },
        });
        expect(response.headers['RateLimit-Remaining']).toBe('3');
        expect(rateLimiter.consume).not.toHaveBeenCalled();
    });

    it('returns 503 when the counter store fails', async () => {
        const { quota } = setup({
            peek: async () => {
                throw new Error('storage down');
            },
        });
        expect((await quota(request(undefined, { method: 'GET' }), context)).status).toBe(503);
    });
});

describe('decision', () => {
    it('forwards only known fields with the configured model and managed identity token', async () => {
        const { decision, fetchMock } = setup();
        const response = await decision(
            request({ ...validBody, model: 'something-else', extra: 'x' }),
            context,
        );

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://foundry.example/providers/microsoft/v1/systemone');
        expect(init.headers.Authorization).toBe('Bearer token-123');
        expect(JSON.parse(init.body)).toEqual({ model: 'msft-decision-1', ...validBody });

        expect(response.status).toBe(200);
        expect(response.jsonBody).toEqual({
            q1: { output: 'True' },
            rateLimit: { limit: 5, remaining: 4, resetSeconds: 42 },
        });
        expect(response.headers['RateLimit-Limit']).toBe('5');
    });

    it('counts requests against the hashed rightmost forwarded address', async () => {
        const { decision, rateLimiter } = setup();
        await decision(request(validBody, { forwardedFor: '6.6.6.6, 203.0.113.7:1' }), context);
        await decision(request(validBody, { forwardedFor: '203.0.113.7:2' }), context);
        const [[first], [second]] = rateLimiter.consume.mock.calls;
        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(second).toBe(first);
    });

    it('returns 429 with Retry-After when the caller is out of requests', async () => {
        const { decision, fetchMock } = setup({
            consume: async () => ({ allowed: false, limit: 5, remaining: 0, resetSeconds: 23 }),
        });
        const response = await decision(request(validBody), context);
        expect(response.status).toBe(429);
        expect(response.headers['Retry-After']).toBe('23');
        expect(response.jsonBody.error.code).toBe('RateLimited');
        expect(response.jsonBody.rateLimit).toEqual({ limit: 5, remaining: 0, resetSeconds: 23 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed when the counter store fails', async () => {
        const { decision, fetchMock } = setup({
            consume: async () => {
                throw new Error('storage down');
            },
        });
        const response = await decision(request(validBody), context);
        expect(response.status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        ['invalid JSON', '{nope', 400, 'InvalidJson'],
        ['a non-object body', [1, 2], 400, 'InvalidRequest'],
        ['missing questions', { state: 'x' }, 400, 'InvalidRequest'],
        [
            'an oversized body',
            { state: 'x'.repeat(MAX_BODY_BYTES), questions: {} },
            413,
            'PayloadTooLarge',
        ],
    ])('rejects %s before counting it', async (_name, body, status, code) => {
        const { decision, rateLimiter } = setup();
        const response = await decision(request(body), context);
        expect(response.status).toBe(status);
        expect(response.jsonBody.error.code).toBe(code);
        expect(rateLimiter.consume).not.toHaveBeenCalled();
    });

    it('passes Foundry errors through with the quota attached', async () => {
        const { decision } = setup({
            fetchImpl: async () =>
                new Response(JSON.stringify({ error: { code: 'BadRequest', message: 'nope' } }), {
                    status: 400,
                }),
        });
        const response = await decision(request(validBody), context);
        expect(response.status).toBe(400);
        expect(response.jsonBody.error.message).toBe('nope');
        expect(response.jsonBody.rateLimit.remaining).toBe(4);
    });

    it('returns 502 when Foundry is unreachable', async () => {
        const { decision } = setup({
            fetchImpl: async () => {
                throw new TypeError('fetch failed');
            },
        });
        const response = await decision(request(validBody), context);
        expect(response.status).toBe(502);
        expect(response.jsonBody.rateLimit.remaining).toBe(4);
    });
});
