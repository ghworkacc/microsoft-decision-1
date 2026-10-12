// Client for the Microsoft-Decision-1 "System 1" API on Microsoft Foundry.
// https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision
//
//   POST {endpoint}/providers/microsoft/v1/systemone
//   { model, state, questions: { <key>: { type: 'choice', instructions, criteria: { <option>: <description> } } } }

export class DecisionApiError extends Error {
    constructor(message, { status, code } = {}) {
        super(message);
        this.name = 'DecisionApiError';
        this.status = status;
        this.code = code;
    }
}

function slugify(label) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Maps each label to a unique, API-friendly option key ("Changed subject" -> "changed_subject").
export function choiceKeys(labels) {
    const used = new Set();
    return labels.map((label, i) => {
        const base = slugify(label) || `choice_${i + 1}`;
        let key = base;
        for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
        used.add(key);
        return key;
    });
}

export function buildDecisionRequest({ deploymentName, questions, state }) {
    if (!questions?.length) throw new DecisionApiError('Add at least one question.');
    if (!state.trim()) throw new DecisionApiError('Enter the state text.');

    const questionsByKey = {};
    const requestQuestions = {};

    questions.forEach((question, index) => {
        const questionNumber = index + 1;
        const instructions = question.instructions.trim();
        if (!instructions)
            throw new DecisionApiError(`Question ${questionNumber}: Enter a question.`);
        if (!['choice', 'noul', 'score'].includes(question.type)) {
            throw new DecisionApiError(
                `Question ${questionNumber}: Choose a supported question type.`,
            );
        }

        const labels = question.choices.map((choice) => choice.trim()).filter(Boolean);
        if (question.type !== 'noul' && labels.length < 2) {
            throw new DecisionApiError(`Question ${questionNumber}: Enter at least two choices.`);
        }

        const key = `question_${questionNumber}`;
        const definition = { type: question.type, instructions };
        if (question.type === 'choice') {
            const keys = choiceKeys(labels);
            definition.criteria = Object.fromEntries(
                keys.map((choiceKey, i) => [choiceKey, labels[i]]),
            );
            questionsByKey[key] = {
                type: question.type,
                question: instructions,
                labelsByKey: definition.criteria,
            };
        } else if (question.type === 'score') {
            definition.criteria = labels;
            questionsByKey[key] = { type: question.type, question: instructions, labels };
        } else {
            questionsByKey[key] = { type: question.type, question: instructions };
        }
        requestQuestions[key] = definition;
    });

    return {
        questionsByKey,
        body: {
            model: deploymentName,
            state,
            questions: requestQuestions,
        },
    };
}

export async function requestDecision({ endpoint, accessToken, body, fetchImpl = fetch }) {
    const response = await fetchImpl(`${endpoint}/providers/microsoft/v1/systemone`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    // Every error status returns a JSON { error: { code, message } } envelope
    // (verified by decisionClient.int.test.js).
    const payload = await response.json();

    if (!response.ok) {
        const { code, message } = payload.error;
        throw new DecisionApiError(message, { status: response.status, code });
    }

    return payload;
}

// Thrown by the anonymous proxy when the caller has used up this minute's quota.
export class RateLimitError extends DecisionApiError {
    constructor(message, { rateLimit } = {}) {
        super(message, { status: 429, code: 'RateLimited' });
        this.name = 'RateLimitError';
        this.rateLimit = rateLimit;
    }
}

function readRateLimit(payload) {
    const rateLimit = payload?.rateLimit;
    const valid =
        isObject(rateLimit) &&
        ['limit', 'remaining', 'resetSeconds'].every((k) => Number.isFinite(rateLimit[k]));
    return valid ? rateLimit : null;
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

// Anonymous mode: POST {proxyUrl}/decision on the rate-limited Function app.
// The proxy adds `rateLimit: { limit, remaining, resetSeconds }` to every body.
export async function requestProxyDecision({ proxyUrl, body, fetchImpl = fetch }) {
    const response = await fetchImpl(`${proxyUrl}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    const rateLimit = readRateLimit(payload);

    if (response.status === 429) {
        throw new RateLimitError(payload?.error?.message ?? 'Too many requests.', { rateLimit });
    }
    if (!response.ok) {
        const error = new DecisionApiError(
            payload?.error?.message ?? `Request failed with status ${response.status}.`,
            { status: response.status, code: payload?.error?.code },
        );
        error.rateLimit = rateLimit;
        throw error;
    }
    return { payload, rateLimit };
}

export async function fetchQuota({ proxyUrl, fetchImpl = fetch }) {
    const response = await fetchImpl(`${proxyUrl}/quota`);
    const payload = await readJson(response);
    const rateLimit = readRateLimit(payload);
    if (!response.ok || !rateLimit) {
        throw new DecisionApiError(
            payload?.error?.message ?? `Quota request failed with status ${response.status}.`,
            { status: response.status, code: payload?.error?.code },
        );
    }
    return rateLimit;
}

// Response contract (verified by decisionClient.int.test.js):
//   { model, usage: { input_tokens, output_tokens }, answers: { <key>: answer } }
//   choice: { type, choice, confidence, probabilities: { <option>: p } }
//   noul:   { type, noul }
//   score:  { type, score, confidence, legend: { '0': label }, probabilities: { '0': p } }
function isObject(value) {
    return typeof value === 'object' && value !== null;
}

function isProbability(value) {
    return typeof value === 'number' && value >= 0 && value <= 1;
}

function unexpectedShape(key, detail) {
    return new DecisionApiError(`Unexpected response shape for ${key}: ${detail}.`);
}

function checkProbabilities(key, probabilities, expectedKeys) {
    const actualKeys = isObject(probabilities) ? Object.keys(probabilities) : [];
    const matches =
        actualKeys.length === expectedKeys.length &&
        expectedKeys.every((k) => isProbability(probabilities[k]));
    if (!matches) {
        throw unexpectedShape(key, `expected probabilities for ${expectedKeys.join(', ')}`);
    }
}

export function parseDecisionResponse(payload, questionsByKey) {
    if (!isObject(payload.answers)) throw unexpectedShape('response', 'missing answers');
    const { usage } = payload;
    if (!Number.isInteger(usage?.input_tokens) || !Number.isInteger(usage?.output_tokens)) {
        throw unexpectedShape('response', 'missing token usage');
    }

    const results = Object.entries(questionsByKey).map(([key, question]) => {
        const answer = payload.answers[key];
        if (!isObject(answer))
            throw new DecisionApiError(`The response did not include an answer for ${key}.`);
        if (answer.type !== question.type)
            throw unexpectedShape(key, `expected type ${question.type}, got ${answer.type}`);

        if (question.type === 'choice') {
            const optionKeys = Object.keys(question.labelsByKey);
            checkProbabilities(key, answer.probabilities, optionKeys);
            if (!optionKeys.includes(answer.choice))
                throw unexpectedShape(key, `unknown choice ${answer.choice}`);
            if (!isProbability(answer.confidence))
                throw unexpectedShape(key, 'expected a confidence between 0 and 1');

            const options = optionKeys
                .map((optionKey) => ({
                    key: optionKey,
                    label: question.labelsByKey[optionKey],
                    probability: answer.probabilities[optionKey],
                }))
                .sort((a, b) => b.probability - a.probability);
            return {
                key,
                type: question.type,
                question: question.question,
                choiceKey: answer.choice,
                choiceLabel: question.labelsByKey[answer.choice],
                confidence: answer.confidence,
                options,
            };
        }

        if (question.type === 'noul') {
            if (!isProbability(answer.noul))
                throw unexpectedShape(key, 'expected a noul probability between 0 and 1');
            return {
                key,
                type: question.type,
                question: question.question,
                confidence: answer.noul,
            };
        }

        const maxScore = question.labels.length - 1;
        checkProbabilities(
            key,
            answer.probabilities,
            question.labels.map((_, i) => String(i)),
        );
        if (typeof answer.score !== 'number' || answer.score < 0 || answer.score > maxScore)
            throw unexpectedShape(key, `expected a score between 0 and ${maxScore}`);

        return {
            key,
            type: question.type,
            question: question.question,
            score: answer.score,
            scoreLabel: question.labels[Math.round(answer.score)],
            options: question.labels.map((label, i) => ({
                key: String(i),
                label,
                probability: answer.probabilities[i],
            })),
        };
    });

    return { results, usage };
}
