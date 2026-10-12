import { describe, expect, it } from 'vitest';
import { readSettings } from './settings.js';

describe('readSettings', () => {
    it('is disabled with safe defaults when nothing is configured', () => {
        expect(readSettings({})).toEqual({
            anonymousMode: false,
            foundryEndpoint: '',
            deploymentName: '',
            rateLimitPerMinute: 5,
            tableEndpoint: '',
            tableName: 'ratelimits',
        });
    });

    it('only enables anonymous mode for "true"', () => {
        expect(readSettings({ ANONYMOUS_MODE: 'True' }).anonymousMode).toBe(true);
        expect(readSettings({ ANONYMOUS_MODE: '1' }).anonymousMode).toBe(false);
        expect(readSettings({ ANONYMOUS_MODE: 'yes' }).anonymousMode).toBe(false);
    });

    it('reads the limit and trims the endpoint', () => {
        const settings = readSettings({
            RATE_LIMIT_PER_MINUTE: '10',
            FOUNDRY_ENDPOINT: 'https://foundry.example//',
        });
        expect(settings.rateLimitPerMinute).toBe(10);
        expect(settings.foundryEndpoint).toBe('https://foundry.example');
    });

    it('ignores invalid limits', () => {
        expect(readSettings({ RATE_LIMIT_PER_MINUTE: '0' }).rateLimitPerMinute).toBe(5);
        expect(readSettings({ RATE_LIMIT_PER_MINUTE: 'abc' }).rateLimitPerMinute).toBe(5);
    });
});
