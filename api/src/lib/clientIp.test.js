import { describe, expect, it } from 'vitest';
import { clientIp, clientKey } from './clientIp.js';

const headers = (forwardedFor) =>
    new Headers(forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor });

describe('clientIp', () => {
    it('uses the rightmost X-Forwarded-For entry', () => {
        expect(clientIp(headers('6.6.6.6, 203.0.113.7'))).toBe('203.0.113.7');
    });

    it('strips IPv4 ports', () => {
        expect(clientIp(headers('203.0.113.7:51234'))).toBe('203.0.113.7');
    });

    it('strips IPv6 brackets and ports', () => {
        expect(clientIp(headers('[2001:db8::1]:443'))).toBe('2001:db8::1');
    });

    it('keeps bare IPv6 addresses intact', () => {
        expect(clientIp(headers('2001:db8::1'))).toBe('2001:db8::1');
    });

    it('falls back to a shared bucket without a forwarded address', () => {
        expect(clientIp(headers())).toBe('unknown');
        expect(clientIp(headers(' , '))).toBe('unknown');
    });
});

describe('clientKey', () => {
    it('hashes the address into a table-safe key', () => {
        const key = clientKey(headers('203.0.113.7:1'));
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(key).toBe(clientKey(headers('1.1.1.1, 203.0.113.7:2')));
        expect(key).not.toBe(clientKey(headers('203.0.113.8')));
    });
});
