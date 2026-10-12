import { describe, expect, it } from 'vitest';
import { RateLimiter, RateLimiterUnavailableError } from './rateLimiter.js';

function statusError(statusCode) {
    return Object.assign(new Error(`status ${statusCode}`), { statusCode });
}

// In-memory stand-in for TableClient with ETag semantics.
function fakeTable() {
    const rows = new Map();
    let version = 0;
    const id = (pk, rk) => `${pk}|${rk}`;
    return {
        rows,
        async getEntity(pk, rk) {
            const row = rows.get(id(pk, rk));
            if (!row) throw statusError(404);
            return { ...row };
        },
        async createEntity(entity) {
            const key = id(entity.partitionKey, entity.rowKey);
            if (rows.has(key)) throw statusError(409);
            rows.set(key, { ...entity, etag: `"${++version}"` });
        },
        async updateEntity(entity, mode, { etag }) {
            const key = id(entity.partitionKey, entity.rowKey);
            const row = rows.get(key);
            if (!row) throw statusError(404);
            if (row.etag !== etag) throw statusError(412);
            rows.set(key, { ...entity, etag: `"${++version}"` });
        },
    };
}

// 10 seconds into a minute window.
function limiter({ table = fakeTable(), limit = 5, at = 1_699_999_990_000 } = {}) {
    const clock = { now: at };
    return {
        table,
        clock,
        limiter: new RateLimiter({ tableClient: table, limit, now: () => clock.now }),
    };
}

describe('RateLimiter', () => {
    it('reports a full quota for unseen clients without writing', async () => {
        const { table, limiter: rl } = limiter();
        expect(await rl.peek('a')).toEqual({ limit: 5, remaining: 5, resetSeconds: 50 });
        expect(table.rows.size).toBe(0);
    });

    it('allows `limit` requests per window, then refuses', async () => {
        const { limiter: rl } = limiter();
        const remaining = [];
        for (let i = 0; i < 5; i++) {
            const result = await rl.consume('a');
            expect(result.allowed).toBe(true);
            remaining.push(result.remaining);
        }
        expect(remaining).toEqual([4, 3, 2, 1, 0]);
        expect(await rl.consume('a')).toEqual({
            allowed: false,
            limit: 5,
            remaining: 0,
            resetSeconds: 50,
        });
        expect(await rl.peek('a')).toMatchObject({ remaining: 0 });
    });

    it('tracks clients independently', async () => {
        const { limiter: rl } = limiter({ limit: 1 });
        expect((await rl.consume('a')).allowed).toBe(true);
        expect((await rl.consume('b')).allowed).toBe(true);
        expect((await rl.consume('a')).allowed).toBe(false);
    });

    it('starts a fresh window each minute', async () => {
        const { clock, limiter: rl } = limiter({ limit: 1 });
        expect((await rl.consume('a')).allowed).toBe(true);
        expect((await rl.consume('a')).allowed).toBe(false);
        clock.now += 50_000;
        expect(await rl.consume('a')).toMatchObject({
            allowed: true,
            remaining: 0,
            resetSeconds: 60,
        });
    });

    it('never over-admits under concurrency', async () => {
        const { limiter: rl } = limiter({ limit: 3 });
        rl.maxAttempts = 50;
        const results = await Promise.all(Array.from({ length: 10 }, () => rl.consume('a')));
        expect(results.filter((r) => r.allowed)).toHaveLength(3);
    });

    it('gives up after repeated conflicts', async () => {
        const table = fakeTable();
        table.createEntity = async () => {
            throw statusError(409);
        };
        const { limiter: rl } = limiter({ table });
        await expect(rl.consume('a')).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    });

    it('propagates storage failures', async () => {
        const table = fakeTable();
        table.getEntity = async () => {
            throw statusError(403);
        };
        const { limiter: rl } = limiter({ table });
        await expect(rl.consume('a')).rejects.toMatchObject({ statusCode: 403 });
    });
});
