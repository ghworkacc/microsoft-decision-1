import { useReducer } from 'react';
import { decisionFormReducer, initialFormState } from '../state/decisionForm.js';

export default function DecisionForm({ onSubmit, busy = false }) {
    const [form, dispatch] = useReducer(decisionFormReducer, initialFormState);

    function handleSubmit(event) {
        event.preventDefault();
        onSubmit(form);
    }

    return (
        <form className="decision-form" onSubmit={handleSubmit}>
            <label className="field">
                <span className="field-label">Question</span>
                <input
                    type="text"
                    value={form.question}
                    onChange={(e) => dispatch({ type: 'setQuestion', value: e.target.value })}
                />
            </label>

            <fieldset className="field choices">
                <legend className="field-label">Choices</legend>
                <ol>
                    {form.choices.map((choice, index) => (
                        <li key={index}>
                            <input
                                type="text"
                                aria-label={`Choice ${index + 1}`}
                                value={choice}
                                onChange={(e) => dispatch({ type: 'setChoice', index, value: e.target.value })}
                            />
                        </li>
                    ))}
                </ol>
                <div className="choice-actions">
                    <button type="button" onClick={() => dispatch({ type: 'addChoice' })}>
                        Add choice
                    </button>
                    <button type="button" onClick={() => dispatch({ type: 'clearChoices' })}>
                        Clear all
                    </button>
                </div>
            </fieldset>

            <label className="field">
                <span className="field-label">State</span>
                <textarea
                    rows={8}
                    value={form.state}
                    onChange={(e) => dispatch({ type: 'setState', value: e.target.value })}
                />
            </label>

            <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Deciding…' : 'Decide'}
            </button>
        </form>
    );
}
