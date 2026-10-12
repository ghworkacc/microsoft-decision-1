import { createHash } from 'node:crypto';

// App Service's front end appends the address of the peer it accepted the
// connection from to X-Forwarded-For, so the rightmost entry is the only one
// a client can't forge. Earlier entries are client-supplied.
export function clientIp(headers) {
    const forwarded = headers.get('x-forwarded-for') ?? '';
    const last = forwarded
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .at(-1);
    return last ? stripPort(last) : 'unknown';
}

function stripPort(address) {
    const bracketed = address.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketed) return bracketed[1];
    const ipv4 = address.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4) return ipv4[1];
    return address;
}

// Table keys can't contain '/', '\', '#' or '?', and we'd rather not store raw
// addresses anyway.
export function clientKey(headers) {
    return createHash('sha256').update(clientIp(headers).toLowerCase()).digest('hex');
}
