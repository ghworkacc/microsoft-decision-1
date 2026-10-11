// Client for the Microsoft-Decision-1 "System 1" API on Microsoft Foundry.
// https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision
//
//   POST {endpoint}/providers/microsoft/v1/systemone
//   { model, state, questions: { <key>: { type: 'choice', instructions, criteria: { <option>: <description> } } } }

export const QUESTION_KEY = 'decision';

export class DecisionApiError extends Error {
    constructor(message, { status, code } = {}) {
        super(message);
        this.name = 'DecisionApiError';
        this.status = status;
        this.code = code;
    }
}

function slugify(label) {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

export function buildDecisionRequest({ deploymentName, question, choices, state }) {
    const instructions = question.trim();
    const labels = choices.map((choice) => choice.trim()).filter(Boolean);

    if (!instructions) throw new DecisionApiError('Enter a question.');
    if (labels.length < 2) throw new DecisionApiError('Enter at least two choices.');
    if (!state.trim()) throw new DecisionApiError('Enter the state text.');

    const keys = choiceKeys(labels);
    const labelsByKey = Object.fromEntries(keys.map((key, i) => [key, labels[i]]));

    return {
        labelsByKey,
        body: {
            model: deploymentName,
            state,
            questions: {
                [QUESTION_KEY]: {
                    type: 'choice',
                    instructions,
                    criteria: labelsByKey,
                },
            },
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

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const error = payload?.error ?? {};
        throw new DecisionApiError(
            error.message || `Request failed with HTTP ${response.status}.`,
            { status: response.status, code: error.code },
        );
    }

    return payload;
}

export function parseDecisionResponse(payload, labelsByKey) {
    const answer = payload?.answers?.[QUESTION_KEY];
    if (!answer) throw new DecisionApiError('The response did not include an answer.');

    const options = Object.entries(answer.probabilities ?? {})
        .map(([key, probability]) => ({ key, label: labelsByKey[key] ?? key, probability }))
        .sort((a, b) => b.probability - a.probability);

    return {
        choiceKey: answer.choice,
        choiceLabel: labelsByKey[answer.choice] ?? answer.choice,
        confidence: answer.confidence,
        options,
        usage: payload.usage ?? null,
    };
}
