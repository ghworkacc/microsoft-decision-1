import { beforeAll, describe, expect, inject, it } from 'vitest';
import {
    DecisionApiError,
    buildDecisionRequest,
    parseDecisionResponse,
    requestDecision,
} from './decisionClient.js';
import { form as supportJudge } from '../samples/support_judge/index.js';
import { form as keepTalking } from '../samples/keep_talking/index.js';

const endpoint = inject('endpoint');
const deploymentName = inject('deploymentName');
const accessToken = inject('accessToken');

function expectProbability(value) {
    expect(value).toBeTypeOf('number');
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
}

function expectDistribution(probabilities, keys) {
    expect(Object.keys(probabilities).sort()).toEqual([...keys].sort());
    Object.values(probabilities).forEach(expectProbability);
    const total = Object.values(probabilities).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 2);
}

function expectKeys(object, keys) {
    expect(Object.keys(object).sort()).toEqual([...keys].sort());
}

// Sends the request through requestDecision while keeping a copy of the raw JSON body.
async function captureDecision(body, { token = accessToken } = {}) {
    let raw;
    let status;
    const fetchImpl = async (...args) => {
        const response = await fetch(...args);
        status = response.status;
        raw = await response.clone().json();
        return response;
    };
    const result = await requestDecision({ endpoint, accessToken: token, body, fetchImpl }).then(
        (payload) => ({ payload }),
        (error) => ({ error }),
    );
    return { ...result, raw, status };
}

function expectErrorEnvelope(raw, code) {
    expectKeys(raw, ['error']);
    expect(raw.error.code).toBe(code);
    expect(raw.error.message).toBeTypeOf('string');
    expect(raw.error.message).not.toBe('');
    for (const key of Object.keys(raw.error)) {
        expect(['code', 'message', 'details']).toContain(key);
    }
}

describe('successful responses', () => {
    let request;
    let captured;

    beforeAll(async () => {
        request = buildDecisionRequest({ deploymentName, ...supportJudge });
        captured = await captureDecision(request.body);
    });

    it('returns 200 with model, answers and usage', () => {
        expect(captured.error).toBeUndefined();
        expect(captured.status).toBe(200);
        expect(captured.payload).toEqual(captured.raw);

        const { raw } = captured;
        expectKeys(raw, ['model', 'answers', 'usage']);
        expect(raw.model).toBe('microsoft-decision-1');
        expectKeys(raw.answers, Object.keys(request.body.questions));
        expectKeys(raw.usage, ['input_tokens', 'output_tokens']);
        expect(Number.isInteger(raw.usage.input_tokens)).toBe(true);
        expect(Number.isInteger(raw.usage.output_tokens)).toBe(true);
    });

    it('answers choice questions with choice, confidence and per-option probabilities', () => {
        const [key, question] = Object.entries(request.body.questions).find(
            ([, q]) => q.type === 'choice',
        );
        const answer = captured.raw.answers[key];
        const optionKeys = Object.keys(question.criteria);

        expectKeys(answer, ['type', 'choice', 'confidence', 'probabilities']);
        expect(answer.type).toBe('choice');
        expect(optionKeys).toContain(answer.choice);
        expectProbability(answer.confidence);
        expectDistribution(answer.probabilities, optionKeys);
    });

    it('answers noul questions with a single noul probability', () => {
        const [key] = Object.entries(request.body.questions).find(([, q]) => q.type === 'noul');
        const answer = captured.raw.answers[key];

        expectKeys(answer, ['type', 'noul']);
        expect(answer.type).toBe('noul');
        expectProbability(answer.noul);
    });

    it('answers score questions with score, confidence, legend and per-level probabilities', () => {
        const scoreQuestions = Object.entries(request.body.questions).filter(
            ([, q]) => q.type === 'score',
        );
        expect(scoreQuestions.length).toBeGreaterThan(0);

        for (const [key, question] of scoreQuestions) {
            const answer = captured.raw.answers[key];
            const levels = question.criteria.map((_, i) => String(i));

            expectKeys(answer, ['type', 'score', 'confidence', 'legend', 'probabilities']);
            expect(answer.type).toBe('score');
            expect(answer.legend).toEqual(
                Object.fromEntries(levels.map((l, i) => [l, question.criteria[i]])),
            );
            expectDistribution(answer.probabilities, levels);
            expectProbability(answer.confidence);
            expect(answer.score).toBeTypeOf('number');
            expect(answer.score).toBeGreaterThanOrEqual(0);
            expect(answer.score).toBeLessThanOrEqual(levels.length - 1);
        }
    });

    it('parses the live support_judge response', () => {
        const parsed = parseDecisionResponse(captured.payload, request.questionsByKey);

        expect(parsed.usage).toEqual(captured.raw.usage);
        expect(parsed.results.map((r) => r.type)).toEqual(
            supportJudge.questions.map((q) => q.type),
        );
        for (const result of parsed.results) {
            expect(result.question).toBe(request.questionsByKey[result.key].question);
            if (result.type === 'choice') {
                expect(supportJudge.questions[0].choices).toContain(result.choiceLabel);
                expectProbability(result.confidence);
                expect(result.options.map((o) => o.label).sort()).toEqual(
                    [...supportJudge.questions[0].choices].sort(),
                );
            } else if (result.type === 'noul') {
                expectProbability(result.confidence);
            } else {
                expect(request.questionsByKey[result.key].labels).toContain(result.scoreLabel);
                expect(result.score).toBeTypeOf('number');
                expect(result.options.map((o) => o.label)).toEqual(
                    request.questionsByKey[result.key].labels,
                );
            }
        }
    });

    it('round-trips the keep_talking sample', async () => {
        const { body, questionsByKey } = buildDecisionRequest({ deploymentName, ...keepTalking });
        const { payload, error } = await captureDecision(body);

        expect(error).toBeUndefined();
        const [result] = parseDecisionResponse(payload, questionsByKey).results;
        expect(keepTalking.questions[0].choices).toContain(result.choiceLabel);
    });
});

describe('error responses', () => {
    const question = { type: 'noul', instructions: 'Is the sky blue?' };

    it('rejects a missing token with a 401 error envelope', async () => {
        const body = { model: deploymentName, state: 'x', questions: { question_1: question } };
        const { error, raw, status } = await captureDecision(body, { token: '' });

        expect(status).toBe(401);
        expectErrorEnvelope(raw, '401');
        expect(error).toBeInstanceOf(DecisionApiError);
        expect(error).toMatchObject({ status: 401, code: '401', message: raw.error.message });
    });

    it('rejects an unsupported question type with a 400 error envelope', async () => {
        const body = {
            model: deploymentName,
            state: 'x',
            questions: { question_1: { ...question, type: 'bogus' } },
        };
        const { error, raw, status } = await captureDecision(body);

        expect(status).toBe(400);
        expectErrorEnvelope(raw, 'unsupported_request_argument');
        expect(error).toMatchObject({ status: 400, code: 'unsupported_request_argument' });
    });

    it('rejects an unknown deployment with a 404 error envelope', async () => {
        const body = {
            model: `${deploymentName}-does-not-exist`,
            state: 'x',
            questions: { question_1: question },
        };
        const { error, raw, status } = await captureDecision(body);

        expect(status).toBe(404);
        expectErrorEnvelope(raw, 'DeploymentNotFound');
        expect(error).toMatchObject({ status: 404, code: 'DeploymentNotFound' });
    });

    it('rejects a malformed JSON body with a 400 error envelope', async () => {
        const response = await fetch(`${endpoint}/providers/microsoft/v1/systemone`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: '{not json',
        });

        expect(response.status).toBe(400);
        expect(response.headers.get('content-type')).toMatch(/^application\/json/);
        expectErrorEnvelope(await response.json(), 'invalid_request');
    });
});
