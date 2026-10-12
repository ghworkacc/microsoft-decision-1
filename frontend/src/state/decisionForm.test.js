import { describe, expect, it } from 'vitest';
import { DEMO_CHOICES, decisionFormReducer, initialFormState } from './decisionForm.js';

describe('decisionFormReducer', () => {
    it('starts with the demo questions and state', () => {
        expect(initialFormState.questions).toHaveLength(3);
        expect(initialFormState.questions[0]).toMatchObject({
            type: 'choice',
            instructions: "In what way has the customer's question been responded?",
            choices: DEMO_CHOICES,
        });
        expect(initialFormState.state).toMatch(
            /^Customer: .*\nAgent: .*msft-decidobot-threesixtyfive/s,
        );
    });

    it('edits a single choice', () => {
        const next = decisionFormReducer(initialFormState, {
            type: 'setChoice',
            id: 'question-1',
            index: 1,
            value: 'Deferred',
        });
        expect(next.questions[0].choices).toEqual(['Answered', 'Deferred', 'Changed subject']);
        expect(initialFormState.questions[0].choices).toEqual(DEMO_CHOICES);
    });

    it('adds an empty choice', () => {
        const next = decisionFormReducer(initialFormState, { type: 'addChoice', id: 'question-1' });
        expect(next.questions[0].choices).toEqual([...DEMO_CHOICES, '']);
    });

    it('removes one choice and can switch types without losing choices', () => {
        let next = decisionFormReducer(initialFormState, {
            type: 'removeChoice',
            id: 'question-1',
            index: 1,
        });
        expect(next.questions[0].choices).toEqual(['Answered', 'Changed subject']);
        next = decisionFormReducer(next, { type: 'setType', id: 'question-1', value: 'noul' });
        next = decisionFormReducer(next, { type: 'setType', id: 'question-1', value: 'score' });
        expect(next.questions[0].choices).toEqual(['Answered', 'Changed subject']);
    });

    it('clears the choices to a single empty choice without touching state', () => {
        const next = decisionFormReducer(initialFormState, {
            type: 'clearChoices',
            id: 'question-1',
        });
        expect(next.questions[0].choices).toEqual(['']);
        expect(next.state).toBe(initialFormState.state);
    });

    it('adds, removes and edits questions', () => {
        let next = decisionFormReducer(initialFormState, { type: 'addQuestion' });
        expect(next.questions).toHaveLength(4);
        const newId = next.questions[3].id;
        next = decisionFormReducer(next, { type: 'setInstructions', id: newId, value: 'Q?' });
        next = decisionFormReducer(next, { type: 'removeQuestion', id: 'question-2' });
        expect(next.questions.map((question) => question.id)).toEqual([
            'question-1',
            'question-3',
            newId,
        ]);
    });

    it('does not remove the last question', () => {
        const oneQuestion = { ...initialFormState, questions: [initialFormState.questions[0]] };
        const next = decisionFormReducer(oneQuestion, { type: 'removeQuestion', id: 'question-1' });
        expect(next).toBe(oneQuestion);
    });

    it('sets the question instructions and state', () => {
        let next = decisionFormReducer(initialFormState, {
            type: 'setInstructions',
            id: 'question-1',
            value: 'Q?',
        });
        next = decisionFormReducer(next, { type: 'setState', value: 'S' });
        expect(next.questions[0].instructions).toBe('Q?');
        expect(next.state).toBe('S');
    });

    it('rejects unknown actions', () => {
        expect(() => decisionFormReducer(initialFormState, { type: 'nope' })).toThrow(
            /Unknown action/,
        );
    });
});
