const WINDOW_MS = 60_000;
const ROW_KEY = 'window';

export class RateLimiterUnavailableError extends Error {}

// Fixed one-minute windows, one Table entity per client. Updates use ETags so
// concurrent requests from the same client can't both take the last slot.
export class RateLimiter {
    constructor({ tableClient, limit, now = Date.now, maxAttempts = 5 }) {
        this.tableClient = tableClient;
        this.limit = limit;
        this.now = now;
        this.maxAttempts = maxAttempts;
    }

    async peek(key) {
        const window = this.#window();
        const entity = await this.#read(key);
        return this.#result(window, this.#countIn(entity, window));
    }

    async consume(key) {
        for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
            const window = this.#window();
            const entity = await this.#read(key);
            const count = this.#countIn(entity, window);
            if (count >= this.limit) return { ...this.#result(window, count), allowed: false };

            const next = {
                partitionKey: key,
                rowKey: ROW_KEY,
                windowStart: window.start,
                count: count + 1,
            };
            try {
                if (entity) {
                    await this.tableClient.updateEntity(next, 'Replace', { etag: entity.etag });
                } else {
                    await this.tableClient.createEntity(next);
                }
                return { ...this.#result(window, count + 1), allowed: true };
            } catch (error) {
                // 412: someone else updated it; 409: someone else created it.
                if (error?.statusCode !== 412 && error?.statusCode !== 409) throw error;
            }
        }
        throw new RateLimiterUnavailableError('Too much contention updating the rate limit.');
    }

    #window() {
        const now = this.now();
        const start = Math.floor(now / WINDOW_MS) * WINDOW_MS;
        return { start, resetSeconds: Math.max(1, Math.ceil((start + WINDOW_MS - now) / 1000)) };
    }

    async #read(key) {
        try {
            return await this.tableClient.getEntity(key, ROW_KEY);
        } catch (error) {
            if (error?.statusCode === 404) return null;
            throw error;
        }
    }

    #countIn(entity, window) {
        return entity && Number(entity.windowStart) === window.start ? Number(entity.count) : 0;
    }

    #result(window, count) {
        return {
            limit: this.limit,
            remaining: Math.max(0, this.limit - count),
            resetSeconds: window.resetSeconds,
        };
    }
}
