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

export function buildDecisionRequest({ deploymentName, questions, state }) {
    if (!questions?.length) throw new DecisionApiError('Add at least one question.');
    if (!state.trim()) throw new DecisionApiError('Enter the state text.');

    const questionsByKey = {};
    const requestQuestions = {};

    questions.forEach((question, index) => {
        const questionNumber = index + 1;
        const instructions = question.instructions.trim();
        if (!instructions) throw new DecisionApiError(`Question ${questionNumber}: Enter a question.`);
        if (!['choice', 'noul', 'score'].includes(question.type)) {
            throw new DecisionApiError(`Question ${questionNumber}: Choose a supported question type.`);
        }

        const labels = question.choices.map((choice) => choice.trim()).filter(Boolean);
        if (question.type !== 'noul' && labels.length < 2) {
            throw new DecisionApiError(`Question ${questionNumber}: Enter at least two choices.`);
        }

        const key = `question_${questionNumber}`;
        const definition = { type: question.type, instructions };
        if (question.type === 'choice') {
            const keys = choiceKeys(labels);
            definition.criteria = Object.fromEntries(keys.map((choiceKey, i) => [choiceKey, labels[i]]));
            questionsByKey[key] = { type: question.type, labelsByKey: definition.criteria };
        } else if (question.type === 'score') {
            definition.criteria = labels;
            questionsByKey[key] = { type: question.type, labels };
        } else {
            questionsByKey[key] = { type: question.type };
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

export function parseDecisionResponse(payload, questionsByKey) {
    const results = Object.entries(questionsByKey).map(([key, question]) => {
        const answer = payload?.answers?.[key];
        if (!answer) throw new DecisionApiError(`The response did not include an answer for ${key}.`);

        if (question.type === 'choice') {
            const options = Object.entries(answer.probabilities ?? {})
                .map(([optionKey, probability]) => ({
                    key: optionKey,
                    label: question.labelsByKey[optionKey] ?? optionKey,
                    probability,
                }))
                .sort((a, b) => b.probability - a.probability);
            return {
                key,
                type: question.type,
                choiceKey: answer.choice,
                choiceLabel: question.labelsByKey[answer.choice] ?? answer.choice,
                confidence: answer.confidence,
                options,
            };
        }

        if (question.type === 'noul') {
            return { key, type: question.type, probability: answer.probability ?? answer.confidence };
        }

        const options = Object.entries(answer.probabilities ?? {})
            .map(([level, probability]) => {
                const index = Number(level);
                const label = question.labels[index] ?? question.labels[level] ?? level;
                return { key: level, label, probability };
            });
        const score = answer.score ?? answer.value;
        const nearestIndex = Math.max(0, Math.min(question.labels.length - 1, Math.round(score ?? 0)));
        return {
            key,
            type: question.type,
            score,
            scoreLabel: question.labels[nearestIndex],
            options,
        };
    });

    return { results, usage: payload.usage ?? null };
}
