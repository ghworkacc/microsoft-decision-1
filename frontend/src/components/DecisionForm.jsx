import { useReducer } from 'react';
import { decisionFormReducer, initialFormState, QUESTION_TYPES } from '../state/decisionForm.js';
import QuestionChoices from './QuestionChoices.jsx';
import QuestionEditor from './QuestionEditor.jsx';
import DecisionResult from './DecisionResult.jsx';
import StateEntry from './StateEntry.jsx';

export const typeLabels = { choice: 'Choice', noul: 'Yes / no', score: 'Score' };

export default function DecisionForm({ onSubmit, busy = false, error = null, result = null }) {
    const [form, dispatch] = useReducer(decisionFormReducer, initialFormState);
    function handleSubmit(event) {
        event.preventDefault();
        onSubmit(form);
    }
    const decideButtonLabel = busy ? 'Deciding…' : 'Decide';

    return (
        <>
            <form className="decision-form" onSubmit={handleSubmit}>
                <StateEntry state={form.state} dispatch={dispatch} />

                <button type="submit" className="primary" disabled={busy}>
                    {decideButtonLabel}
                </button>

                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                {result && <DecisionResult result={result} />}

                {form.questions.map((question, index) => (
                    <QuestionEditor
                        key={question.id}
                        question={question}
                        index={index}
                        canRemove={form.questions.length > 1}
                        dispatch={dispatch}
                    />
                ))}

                <button type="button" onClick={() => dispatch({ type: 'addQuestion' })}>
                    Add question
                </button>
            </form>
        </>
    );
}
