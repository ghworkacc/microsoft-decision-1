import * as supportJudge from '../samples/support_judge/index.js';

export const { DEMO_QUESTION, DEMO_CHOICES, DEMO_QUESTIONS, DEMO_STATE } = supportJudge;

export const QUESTION_TYPES = ['choice', 'noul', 'score'];

export const initialFormState = {
    questions: DEMO_QUESTIONS,
    state: DEMO_STATE,
};

let nextQuestionId = 5;

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
