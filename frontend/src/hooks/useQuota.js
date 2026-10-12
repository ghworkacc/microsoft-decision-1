import { useCallback, useEffect, useState } from 'react';
import { fetchQuota } from '../api/decisionClient.js';

// Small delay so the refresh lands after the server's window has rolled over.
const RESET_GRACE_MS = 250;

function toQuota({ limit, remaining, resetSeconds }) {
    return { limit, remaining, resetAt: Date.now() + resetSeconds * 1000 };
}

// Tracks the anonymous proxy's per-minute quota for this client. `quota` is
// null until the first response; `update` applies a `rateLimit` from any
// proxy response.
export function useQuota({ proxyUrl, fetchImpl }) {
    const [quota, setQuota] = useState(null);

    const refresh = useCallback(async () => {
        try {
            setQuota(toQuota(await fetchQuota({ proxyUrl, fetchImpl })));
        } catch {
            // Keep the last known value; the next decision response updates it.
        }
    }, [proxyUrl, fetchImpl]);

    const update = useCallback((rateLimit) => {
        if (rateLimit) setQuota(toQuota(rateLimit));
    }, []);

    useEffect(() => {
        let active = true;
        fetchQuota({ proxyUrl, fetchImpl }).then(
            (rateLimit) => active && setQuota(toQuota(rateLimit)),
            () => {},
        );
        return () => {
            active = false;
        };
    }, [proxyUrl, fetchImpl]);

    // Once a partly used window ends, fetch the fresh quota.
    const pendingResetAt = quota && quota.remaining < quota.limit ? quota.resetAt : null;
    useEffect(() => {
        if (pendingResetAt === null) return undefined;
        const id = setTimeout(refresh, Math.max(0, pendingResetAt - Date.now()) + RESET_GRACE_MS);
        return () => clearTimeout(id);
    }, [pendingResetAt, refresh]);

    return { quota, update, refresh };
}
