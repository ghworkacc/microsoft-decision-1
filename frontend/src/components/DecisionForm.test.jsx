import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DecisionForm from './DecisionForm.jsx';

function choiceValues() {
    return screen.getAllByRole('textbox', { name: /^Choice 1\.\d+$/ }).map((input) => input.value);
}

describe('DecisionForm', () => {
    it('renders the three demo question types', () => {
        render(<DecisionForm onSubmit={() => {}} />);

        expect(screen.getByRole('combobox', { name: 'Question 1 type' }).value).toBe('choice');
        expect(screen.getByRole('combobox', { name: 'Question 2 type' }).value).toBe('noul');
        expect(screen.getByRole('combobox', { name: 'Question 3 type' }).value).toBe('score');
        expect(choiceValues()).toEqual(['Answered', 'Promised to answer', 'Changed subject']);
        expect(screen.getByRole('textbox', { name: 'State' }).value).toMatch(/^Customer: /);
    });

    it('removes one choice without removing the others', async () => {
        const user = userEvent.setup();
        render(<DecisionForm onSubmit={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Remove choice 2' }));
        expect(choiceValues()).toEqual(['Answered', 'Changed subject']);
    });

    it('adds and removes questions', async () => {
        const user = userEvent.setup();
        render(<DecisionForm onSubmit={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Add question' }));
        expect(screen.getAllByRole('group')).toHaveLength(4);
        await user.click(screen.getAllByRole('button', { name: 'Remove question' })[3]);
        expect(screen.getAllByRole('group')).toHaveLength(3);
    });

    it('hides choices for noul and restores them when switching back', async () => {
        const user = userEvent.setup();
        render(<DecisionForm onSubmit={() => {}} />);
        const type = screen.getByRole('combobox', { name: 'Question 1 type' });

        await user.selectOptions(type, 'noul');
        expect(screen.queryByRole('textbox', { name: 'Choice 1.1' })).toBeNull();
        await user.selectOptions(type, 'choice');
        expect(screen.getByRole('textbox', { name: 'Choice 1.1' }).value).toBe('Answered');
    });

    it('submits all current questions and the shared state', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<DecisionForm onSubmit={onSubmit} />);

        await user.click(screen.getByRole('button', { name: 'Decide' }));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                questions: expect.arrayContaining([
                    expect.objectContaining({ type: 'choice' }),
                    expect.objectContaining({ type: 'noul' }),
                    expect.objectContaining({ type: 'score' }),
                ]),
                state: expect.stringMatching(/^Customer: /),
            }),
        );
    });

    it('disables submit while busy', () => {
        render(<DecisionForm onSubmit={() => {}} busy />);
        expect(screen.getByRole('button', { name: 'Deciding…' }).disabled).toBe(true);
    });
});
