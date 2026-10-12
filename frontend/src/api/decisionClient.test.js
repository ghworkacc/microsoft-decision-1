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
    questions: [
        {
            id: 'q1',
            type: 'choice',
            instructions: "In what way has the customer's question been responded?",
            choices: ['Answered', 'Promised to answer', ' Changed subject ', ''],
        },
        { id: 'q2', type: 'noul', instructions: 'Was a workaround provided?', choices: [] },
        { id: 'q3', type: 'score', instructions: 'How satisfied?', choices: ['Low', 'High', ''] },
    ],
    state: 'Customer: hi\nAgent: hello',
};

const livePayload = {
    model: 'microsoft-decision-1',
    answers: {
        question_1: {
            choice: 'changed_subject',
            confidence: 0.545,
            probabilities: { answered: 0.29, changed_subject: 0.697, promised_to_answer: 0.0128 },
            type: 'choice',
        },
        question_2: { noul: 0.9988304897893894, type: 'noul' },
        question_3: {
            confidence: 0.5098299847632095,
            legend: { 0: 'Low', 1: 'High' },
            probabilities: { 0: 0.24508500761839527, 1: 0.7549149923816048 },
            score: 0.7549149923816048,
            type: 'score',
        },
    },
    usage: { input_tokens: 215, output_tokens: 4 },
};

function withAnswer(key, answer) {
    return { ...livePayload, answers: { ...livePayload.answers, [key]: answer } };
}

describe('choiceKeys', () => {
    it('slugifies labels and keeps them unique', () => {
        expect(choiceKeys(['Answered', 'Changed subject', 'answered', '!!!'])).toEqual([
            'answered',
            'changed_subject',
            'answered_2',
            'choice_4',
        ]);
    });
});

describe('buildDecisionRequest', () => {
    it('builds a single choice question, skipping blank choices', () => {
        const { body, questionsByKey } = buildDecisionRequest(form);

        expect(body).toEqual({
            model: 'msft-decision-1',
            state: form.state,
            questions: {
                question_1: {
                    type: 'choice',
                    instructions: form.questions[0].instructions,
                    criteria: {
                        answered: 'Answered',
                        promised_to_answer: 'Promised to answer',
                        changed_subject: 'Changed subject',
                    },
                },
                question_2: { type: 'noul', instructions: 'Was a workaround provided?' },
                question_3: {
                    type: 'score',
                    instructions: 'How satisfied?',
                    criteria: ['Low', 'High'],
                },
            },
        });
        expect(questionsByKey.question_1.labelsByKey.changed_subject).toBe('Changed subject');
        expect(questionsByKey.question_3.labels).toEqual(['Low', 'High']);
    });

    it.each([
        [{ questions: [{ ...form.questions[0], instructions: ' ' }] }, /Question 1/],
        [{ questions: [{ ...form.questions[0], choices: ['Only one', ''] }] }, /two choices/],
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
            status: 404,
            json: async () => ({
                error: {
                    code: 'DeploymentNotFound',
                    message: 'The API deployment nope does not exist.',
                    details: 'The API deployment nope does not exist.',
                },
            }),
        });

        const error = await requestDecision({
            endpoint: 'e',
            accessToken: 't',
            body: {},
            fetchImpl,
        }).catch((e) => e);

        expect(error).toBeInstanceOf(DecisionApiError);
        expect(error).toMatchObject({
            message: 'The API deployment nope does not exist.',
            status: 404,
            code: 'DeploymentNotFound',
        });
    });
});

describe('parseDecisionResponse', () => {
    const { questionsByKey } = buildDecisionRequest(form);

    it('maps choice keys back to labels and sorts by probability', () => {
        const result = parseDecisionResponse(livePayload, questionsByKey);

        expect(result.results[0]).toMatchObject({
            question: form.questions[0].instructions,
            choiceKey: 'changed_subject',
            choiceLabel: 'Changed subject',
            confidence: 0.545,
        });
        expect(result.results[0].options.map((o) => o.label)).toEqual([
            'Changed subject',
            'Answered',
            'Promised to answer',
        ]);
        expect(result.usage).toEqual({ input_tokens: 215, output_tokens: 4 });
    });

    it('reads the noul probability', () => {
        const result = parseDecisionResponse(livePayload, questionsByKey);

        expect(result.results[1]).toMatchObject({ type: 'noul', confidence: 0.9988304897893894 });
    });

    it('maps score levels to labels in scale order', () => {
        const result = parseDecisionResponse(livePayload, questionsByKey);

        expect(result.results[2]).toMatchObject({
            type: 'score',
            score: 0.7549149923816048,
            scoreLabel: 'High',
            options: [
                { key: '0', label: 'Low', probability: 0.24508500761839527 },
                { key: '1', label: 'High', probability: 0.7549149923816048 },
            ],
        });
    });

    it('throws when the answer is missing', () => {
        const { question_2, ...answers } = livePayload.answers;
        expect(question_2).toBeDefined();
        expect(() => parseDecisionResponse({ ...livePayload, answers }, questionsByKey)).toThrow(
            /did not include an answer for question_2/,
        );
    });

    it.each([
        ['missing answers', { ...livePayload, answers: undefined }, /response: missing answers/],
        ['missing usage', { ...livePayload, usage: undefined }, /response: missing token usage/],
        [
            'a mismatched answer type',
            withAnswer('question_2', { probability: 0.9, type: 'choice' }),
            /question_2: expected type noul, got choice/,
        ],
        [
            'a noul answer without the noul field',
            withAnswer('question_2', { probability: 0.9, type: 'noul' }),
            /question_2: expected a noul probability/,
        ],
        [
            'a choice outside the criteria',
            withAnswer('question_1', { ...livePayload.answers.question_1, choice: 'other' }),
            /question_1: unknown choice other/,
        ],
        [
            'choice probabilities that do not match the criteria',
            withAnswer('question_1', {
                ...livePayload.answers.question_1,
                probabilities: { answered: 0.5, other: 0.5 },
            }),
            /question_1: expected probabilities for answered, promised_to_answer, changed_subject/,
        ],
        [
            'a score answer using value instead of score',
            withAnswer('question_3', {
                ...livePayload.answers.question_3,
                score: undefined,
                value: 0.75,
            }),
            /question_3: expected a score between 0 and 1/,
        ],
        [
            'score probabilities keyed by label',
            withAnswer('question_3', {
                ...livePayload.answers.question_3,
                probabilities: { Low: 0.25, High: 0.75 },
            }),
            /question_3: expected probabilities for 0, 1/,
        ],
    ])('rejects %s as an unexpected response shape', (_, payload, message) => {
        expect(() => parseDecisionResponse(payload, questionsByKey)).toThrow(DecisionApiError);
        expect(() => parseDecisionResponse(payload, questionsByKey)).toThrow(message);
    });
});
