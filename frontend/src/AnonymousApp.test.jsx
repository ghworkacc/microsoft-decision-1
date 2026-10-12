import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnonymousApp from './AnonymousApp.jsx';

const PROXY = 'https://func.example/api';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Builds a valid model response for whatever questions were asked.
function answersFor(questions) {
    const answers = {};
    for (const [key, question] of Object.entries(questions)) {
        if (question.type === 'choice') {
            const options = Object.keys(question.criteria);
            answers[key] = {
                type: 'choice',
                choice: options[0],
                confidence: 0.5,
                probabilities: Object.fromEntries(options.map((o) => [o, 1 / options.length])),
            };
        } else if (question.type === 'noul') {
            answers[key] = { type: 'noul', noul: 0.9 };
        } else {
            const scores = question.criteria.map((_, i) => String(i));
            answers[key] = {
                type: 'score',
                score: 0,
                confidence: 0.5,
                probabilities: Object.fromEntries(scores.map((s) => [s, 1 / scores.length])),
            };
        }
    }
    return { model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, answers };
}

// Fake proxy: `quotas` are served in order by GET /quota (last one repeats);
// `decide` handles POST /decision.
function fakeProxy({ quotas = [{ limit: 5, remaining: 5, resetSeconds: 60 }], decide } = {}) {
    let quotaCalls = 0;
    return vi.fn(async (url, init) => {
        if (url === `${PROXY}/quota`) {
            const rateLimit = quotas[Math.min(quotaCalls++, quotas.length - 1)];
            return jsonResponse(200, { rateLimit });
        }
        if (url === `${PROXY}/decision`) return decide(JSON.parse(init.body), init);
        throw new Error(`Unexpected request to ${url}`);
    });
}

function decisionCalls(fetchImpl) {
    return fetchImpl.mock.calls.filter(([url]) => url === `${PROXY}/decision`);
}

describe('AnonymousApp', () => {
    it('shows the remaining quota without asking anyone to sign in', async () => {
        const fetchImpl = fakeProxy({ quotas: [{ limit: 5, remaining: 3, resetSeconds: 60 }] });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);

        expect((await screen.findByRole('status')).textContent).toBe(
            '3/5 requests left this minute',
        );
        expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    });

    it('decides through the proxy and updates the quota from the response', async () => {
        const user = userEvent.setup();
        const fetchImpl = fakeProxy({
            decide: (body) =>
                jsonResponse(200, {
                    ...answersFor(body.questions),
                    rateLimit: { limit: 5, remaining: 4, resetSeconds: 50 },
                }),
        });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);
        await screen.findByText('5/5 requests left this minute');

        await user.click(screen.getByRole('button', { name: 'Decide' }));

        expect(await screen.findByText('4/5 requests left this minute')).toBeTruthy();
        const [[, init]] = decisionCalls(fetchImpl);
        expect(init.headers).not.toHaveProperty('Authorization');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('opens the limit modal instead of calling the proxy when no requests are left', async () => {
        const user = userEvent.setup();
        const decide = vi.fn();
        const fetchImpl = fakeProxy({
            quotas: [{ limit: 5, remaining: 0, resetSeconds: 40 }],
            decide,
        });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);
        await screen.findByText('0/5 requests left this minute');

        await user.click(screen.getByRole('button', { name: 'Decide' }));

        expect(screen.getByRole('dialog', { name: 'Request limit reached' })).toBeTruthy();
        expect(screen.getByRole('timer').textContent).toMatch(/try again in (39|40) seconds/);
        expect(decide).not.toHaveBeenCalled();
    });

    it('opens the limit modal when the proxy answers 429', async () => {
        const user = userEvent.setup();
        const fetchImpl = fakeProxy({
            decide: () =>
                jsonResponse(429, {
                    error: { code: 'RateLimited', message: 'Slow down.' },
                    rateLimit: { limit: 5, remaining: 0, resetSeconds: 25 },
                }),
        });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);
        await screen.findByText('5/5 requests left this minute');

        await user.click(screen.getByRole('button', { name: 'Decide' }));

        expect(await screen.findByRole('dialog', { name: 'Request limit reached' })).toBeTruthy();
        expect(screen.getByText('0/5 requests left this minute')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('closes the modal when the countdown ends and refreshes the quota', async () => {
        const user = userEvent.setup();
        const fetchImpl = fakeProxy({
            quotas: [
                { limit: 5, remaining: 0, resetSeconds: 1 },
                { limit: 5, remaining: 5, resetSeconds: 60 },
            ],
        });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);
        await screen.findByText('0/5 requests left this minute');

        await user.click(screen.getByRole('button', { name: 'Decide' }));
        expect(screen.getByRole('dialog')).toBeTruthy();

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
        expect(await screen.findByText('5/5 requests left this minute')).toBeTruthy();
    });

    it('shows other proxy errors inline', async () => {
        const user = userEvent.setup();
        const fetchImpl = fakeProxy({
            decide: () =>
                jsonResponse(404, {
                    error: {
                        code: 'AnonymousModeDisabled',
                        message: 'Anonymous access is not enabled.',
                    },
                }),
        });
        render(<AnonymousApp proxyUrl={PROXY} fetchImpl={fetchImpl} />);
        await screen.findByRole('status');

        await user.click(screen.getByRole('button', { name: 'Decide' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Anonymous access is not enabled.',
        );
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
