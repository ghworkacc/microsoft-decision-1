import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DecisionForm from './DecisionForm.jsx';

function choiceValues() {
    return screen.getAllByRole('textbox', { name: /^Choice \d+$/ }).map((input) => input.value);
}

describe('DecisionForm', () => {
    it('renders the demo defaults', () => {
        render(<DecisionForm onSubmit={() => {}} />);

        expect(screen.getByRole('textbox', { name: 'Question' }).value)
            .toBe('In what way has the customer\'s question been responded?');
        expect(choiceValues()).toEqual(['Answered', 'Promised to answer', 'Changed subject']);
        expect(screen.getByRole('textbox', { name: 'State' }).value).toMatch(/^Customer: /);
    });

    it('adds a choice and edits it', async () => {
        const user = userEvent.setup();
        render(<DecisionForm onSubmit={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Add choice' }));
        await user.type(screen.getByRole('textbox', { name: 'Choice 4' }), 'Escalated');

        expect(choiceValues()).toEqual(['Answered', 'Promised to answer', 'Changed subject', 'Escalated']);
    });

    it('clears all choices down to one empty choice', async () => {
        const user = userEvent.setup();
        render(<DecisionForm onSubmit={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Clear all' }));

        expect(choiceValues()).toEqual(['']);
    });

    it('submits the current form values', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<DecisionForm onSubmit={onSubmit} />);

        const question = screen.getByRole('textbox', { name: 'Question' });
        await user.clear(question);
        await user.type(question, 'Was it resolved?');
        await user.click(screen.getByRole('button', { name: 'Decide' }));

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            question: 'Was it resolved?',
            choices: ['Answered', 'Promised to answer', 'Changed subject'],
        }));
    });

    it('disables submit while busy', () => {
        render(<DecisionForm onSubmit={() => {}} busy />);

        expect(screen.getByRole('button', { name: 'Deciding…' }).disabled).toBe(true);
    });
});
