import { describe, expect, it } from 'vitest';
import { DEMO_CHOICES, decisionFormReducer, initialFormState } from './decisionForm.js';

describe('decisionFormReducer', () => {
    it('starts with the demo question, choices and state', () => {
        expect(initialFormState.question).toBe('In what way has the customer\'s question been responded?');
        expect(initialFormState.choices).toEqual(['Answered', 'Promised to answer', 'Changed subject']);
        expect(initialFormState.state).toMatch(/^Customer: .*\nAgent: .*msft-decidobot-threesixtyfive/s);
    });

    it('edits a single choice', () => {
        const next = decisionFormReducer(initialFormState, { type: 'setChoice', index: 1, value: 'Deferred' });
        expect(next.choices).toEqual(['Answered', 'Deferred', 'Changed subject']);
        expect(initialFormState.choices).toEqual(DEMO_CHOICES);
    });

    it('adds an empty choice', () => {
        const next = decisionFormReducer(initialFormState, { type: 'addChoice' });
        expect(next.choices).toEqual([...DEMO_CHOICES, '']);
    });

    it('clears the choices to a single empty choice without touching question or state', () => {
        const next = decisionFormReducer(initialFormState, { type: 'clearChoices' });
        expect(next.choices).toEqual(['']);
        expect(next.question).toBe(initialFormState.question);
        expect(next.state).toBe(initialFormState.state);
    });

    it('sets the question and state', () => {
        let next = decisionFormReducer(initialFormState, { type: 'setQuestion', value: 'Q?' });
        next = decisionFormReducer(next, { type: 'setState', value: 'S' });
        expect(next).toMatchObject({ question: 'Q?', state: 'S' });
    });

    it('rejects unknown actions', () => {
        expect(() => decisionFormReducer(initialFormState, { type: 'nope' })).toThrow(/Unknown action/);
    });
});
