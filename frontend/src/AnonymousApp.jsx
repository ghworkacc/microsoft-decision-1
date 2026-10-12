import { useCallback, useState } from 'react';
import { config } from './config.js';
import { RateLimitError, requestProxyDecision } from './api/decisionClient.js';
import AppLayout from './components/AppLayout.jsx';
import DecisionForm from './components/DecisionForm.jsx';
import QuotaBadge from './components/QuotaBadge.jsx';
import RateLimitModal from './components/RateLimitModal.jsx';
import { useDecisionSubmit } from './hooks/useDecisionSubmit.js';
import { useQuota } from './hooks/useQuota.js';

const DEFAULT_WINDOW_SECONDS = 60;

// No sign-in: decisions go through the rate-limited Function app proxy.
export default function AnonymousApp({ proxyUrl = config.proxyUrl, fetchImpl }) {
    const { quota, update, refresh } = useQuota({ proxyUrl, fetchImpl });
    // When set, the rate-limit modal is open and counts down to this time.
    const [limitResetAt, setLimitResetAt] = useState(null);

    const decision = useDecisionSubmit(async (body) => {
        try {
            const { payload, rateLimit } = await requestProxyDecision({
                proxyUrl,
                body,
                fetchImpl,
            });
            update(rateLimit);
            return payload;
        } catch (e) {
            update(e.rateLimit);
            if (e instanceof RateLimitError) {
                const seconds = e.rateLimit?.resetSeconds ?? DEFAULT_WINDOW_SECONDS;
                setLimitResetAt(Date.now() + seconds * 1000);
            }
            throw e;
        }
    });

    function handleSubmit(form) {
        if (quota?.remaining === 0) {
            setLimitResetAt(quota.resetAt);
            return;
        }
        decision.submit(form);
    }

    const closeLimit = useCallback(() => {
        setLimitResetAt(null);
        refresh();
    }, [refresh]);

    return (
        <AppLayout
            headerActions={<span className="user">Anonymous (rate limited)</span>}
            onSampleChange={decision.reset}
        >
            {(sample) => (
                <>
                    <DecisionForm
                        key={sample.name}
                        onSubmit={handleSubmit}
                        initialState={sample.form}
                        busy={decision.busy}
                        error={decision.error}
                        result={decision.result}
                        onDismissResult={decision.dismissResult}
                        submitAccessory={<QuotaBadge quota={quota} />}
                    />
                    {limitResetAt !== null && (
                        <RateLimitModal
                            limit={quota?.limit}
                            resetAt={limitResetAt}
                            onClose={closeLimit}
                        />
                    )}
                </>
            )}
        </AppLayout>
    );
}
