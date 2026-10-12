export const DEMO_QUESTION = "In what way has the customer's question been responded?";

export const DEMO_CHOICES = ['Answered', 'Promised to answer', 'Changed subject'];

export const QUESTION_TYPES = ['choice', 'noul', 'score'];

export const DEMO_QUESTIONS = [
    {
        id: 'question-1',
        type: 'choice',
        instructions: DEMO_QUESTION,
        choices: DEMO_CHOICES,
    },
    {
        id: 'question-2',
        type: 'noul',
        instructions: 'Did the agent provide a workaround for the customer?',
        choices: [],
    },
    {
        id: 'question-3',
        type: 'score',
        instructions: 'How satisfied is the customer likely to be?',
        choices: ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'],
    },
    {
        id: 'question-4',
        type: 'score',
        instructions: 'How satisfied is the customer likely to be?',
        choices: ['Dissatisfied', 'Satisfied'],
    },
];

export const DEMO_STATE = [
    'Customer: I\'m having trouble setting up my model deployment.  It says "error - name included a reserved word"',
    'Agent: The default deployment unfortunately used a reserved word.  To work around the issue, you need to ' +
        "create a custom deployment and provide it an alternative name (e.g. 'msft-decidobot-threesixtyfive').",
].join('\n');

export const initialFormState = {
    questions: DEMO_QUESTIONS,
    state: DEMO_STATE,
};

let nextQuestionId = 4;

function newQuestion() {
    return {
        id: `question-${nextQuestionId++}`,
        type: 'choice',
        instructions: '',
        choices: [''],
    };
}

function updateQuestion(form, id, update) {
    return {
        ...form,
        questions: form.questions.map((question) =>
            question.id === id ? { ...question, ...update(question) } : question,
        ),
    };
}

export function decisionFormReducer(form, action) {
    switch (action.type) {
        case 'setInstructions':
            return updateQuestion(form, action.id, () => ({ instructions: action.value }));
        case 'setType':
            return updateQuestion(form, action.id, () => ({ type: action.value }));
        case 'setChoice':
            return updateQuestion(form, action.id, (question) => ({
                choices: question.choices.map((choice, i) =>
                    i === action.index ? action.value : choice,
                ),
            }));
        case 'addChoice':
            return updateQuestion(form, action.id, (question) => ({
                choices: [...question.choices, ''],
            }));
        case 'removeChoice':
            return updateQuestion(form, action.id, (question) => ({
                choices: question.choices.filter((_, i) => i !== action.index),
            }));
        case 'clearChoices':
            return updateQuestion(form, action.id, () => ({ choices: [''] }));
        case 'addQuestion':
            return { ...form, questions: [...form.questions, newQuestion()] };
        case 'removeQuestion':
            if (form.questions.length === 1) return form;
            return {
                ...form,
                questions: form.questions.filter((question) => question.id !== action.id),
            };
        case 'setState':
            return { ...form, state: action.value };
        default:
            throw new Error(`Unknown action: ${action.type}`);
    }
}
