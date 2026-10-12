import { useState } from 'react';
import { config } from '../config.js';
import {
    RateLimitError,
    buildDecisionRequest,
    parseDecisionResponse,
} from '../api/decisionClient.js';

// Form submission state shared by both apps. `decide(body)` sends the request
// and resolves with the raw response payload.
export function useDecisionSubmit(decide) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    async function submit(form) {
        setError(null);
        setResult(null);
        setBusy(true);
        try {
            const { body, questionsByKey } = buildDecisionRequest({
                deploymentName: config.deploymentName,
                ...form,
            });
            const payload = await decide(body);
            setResult(parseDecisionResponse(payload, questionsByKey));
        } catch (e) {
            // The anonymous app explains rate limits in a modal instead.
            if (!(e instanceof RateLimitError)) setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    function reset() {
        setResult(null);
        setError(null);
    }

    return { busy, error, result, submit, reset, dismissResult: () => setResult(null) };
}
