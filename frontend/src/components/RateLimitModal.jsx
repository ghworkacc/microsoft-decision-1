import { useEffect, useState } from 'react';

const TICK_MS = 250;

function secondsUntil(resetAt) {
    return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
}

// Explains the anonymous request cap and counts down to the next window.
// Calls `onClose` when dismissed or when the countdown reaches zero.
export default function RateLimitModal({ limit, resetAt, onClose }) {
    const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(resetAt));

    useEffect(() => {
        const id = setInterval(() => {
            const seconds = secondsUntil(resetAt);
            setSecondsLeft(seconds);
            if (seconds === 0) {
                clearInterval(id);
                onClose();
            }
        }, TICK_MS);
        return () => clearInterval(id);
    }, [resetAt, onClose]);

    function handleKeyDown(event) {
        if (event.key === 'Escape') onClose();
    }

    const allowance = Number.isFinite(limit)
        ? `${limit} ${limit === 1 ? 'decision' : 'decisions'}`
        : 'a few decisions';

    return (
        <div className="modal-backdrop">
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rate-limit-title"
                aria-describedby="rate-limit-description"
                onKeyDown={handleKeyDown}
            >
                <h2 id="rate-limit-title">Request limit reached</h2>
                <p id="rate-limit-description">
                    Without signing in, each visitor can make {allowance} per minute. The cap keeps
                    the shared model available for everyone.
                </p>
                <p className="countdown" role="timer">
                    You can try again in <strong>{secondsLeft}</strong>{' '}
                    {secondsLeft === 1 ? 'second' : 'seconds'}.
                </p>
                <button type="button" className="primary" onClick={onClose} autoFocus>
                    OK
                </button>
            </div>
        </div>
    );
}
