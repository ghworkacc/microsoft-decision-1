import { describe, expect, it, vi } from 'vitest';
import {
    DecisionApiError,
    buildDecisionRequest,
    choiceKeys,
    parseDecisionResponse,
    requestDecision,
} from './decisionClient.js';

const form = {
    deploymentName: 'msft-decision-1',
    question: 'In what way has the customer\'s question been responded?',
    choices: ['Answered', 'Promised to answer', ' Changed subject ', ''],
    state: 'Customer: hi\nAgent: hello',
};

// Response captured from the live API.
const livePayload = {
    model: 'microsoft-decision-1',
    answers: {
        decision: {
            choice: 'changed_subject',
            confidence: 0.545,
            probabilities: { answered: 0.29, changed_subject: 0.697, promised_to_answer: 0.0128 },
            type: 'choice',
        },
    },
    usage: { input_tokens: 66, output_tokens: 1 },
};

describe('choiceKeys', () => {
    it('slugifies labels and keeps them unique', () => {
        expect(choiceKeys(['Answered', 'Changed subject', 'answered', '!!!'])).toEqual([
            'answered', 'changed_subject', 'answered_2', 'choice_4',
        ]);
    });
});

describe('buildDecisionRequest', () => {
    it('builds a single choice question, skipping blank choices', () => {
        const { body, labelsByKey } = buildDecisionRequest(form);

        expect(body).toEqual({
            model: 'msft-decision-1',
            state: form.state,
            questions: {
                decision: {
                    type: 'choice',
                    instructions: form.question,
                    criteria: {
                        answered: 'Answered',
                        promised_to_answer: 'Promised to answer',
                        changed_subject: 'Changed subject',
                    },
                },
            },
        });
        expect(labelsByKey.changed_subject).toBe('Changed subject');
    });

    it.each([
        [{ question: ' ' }, /question/],
        [{ choices: ['Only one', ''] }, /two choices/],
        [{ state: '' }, /state/],
    ])('validates %o', (override, message) => {
        expect(() => buildDecisionRequest({ ...form, ...override })).toThrow(message);
    });
});

describe('requestDecision', () => {
    it('POSTs to the System 1 route with a bearer token', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => livePayload });

        const payload = await requestDecision({
            endpoint: 'https://the-new-foundry.services.ai.azure.com',
            accessToken: 'tok',
            body: { model: 'm' },
            fetchImpl,
        });

        expect(payload).toBe(livePayload);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://the-new-foundry.services.ai.azure.com/providers/microsoft/v1/systemone',
            {
                method: 'POST',
                headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
                body: '{"model":"m"}',
            },
        );
    });

    it('surfaces the API error envelope', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ error: { code: 'invalid_question', message: 'Bad question' } }),
        });

        const error = await requestDecision({ endpoint: 'e', accessToken: 't', body: {}, fetchImpl })
            .catch((e) => e);

        expect(error).toBeInstanceOf(DecisionApiError);
        expect(error).toMatchObject({ message: 'Bad question', status: 422, code: 'invalid_question' });
    });

    it('falls back to the HTTP status when the body is not JSON', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => { throw new SyntaxError('not json'); },
        });

        await expect(requestDecision({ endpoint: 'e', accessToken: 't', body: {}, fetchImpl }))
            .rejects.toThrow('Request failed with HTTP 401.');
    });
});

describe('parseDecisionResponse', () => {
    it('maps keys back to labels and sorts by probability', () => {
        const { labelsByKey } = buildDecisionRequest(form);
        const result = parseDecisionResponse(livePayload, labelsByKey);

        expect(result).toMatchObject({
            choiceKey: 'changed_subject',
            choiceLabel: 'Changed subject',
            confidence: 0.545,
            usage: { input_tokens: 66, output_tokens: 1 },
        });
        expect(result.options.map((o) => o.label)).toEqual(['Changed subject', 'Answered', 'Promised to answer']);
    });

    it('throws when the answer is missing', () => {
        expect(() => parseDecisionResponse({ answers: {} }, {})).toThrow(/did not include an answer/);
    });
});
