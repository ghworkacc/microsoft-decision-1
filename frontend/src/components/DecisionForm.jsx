import { useReducer } from 'react';
import { decisionFormReducer, initialFormState } from '../state/decisionForm.js';
import QuestionEditor from './QuestionEditor.jsx';
import DecisionResult from './DecisionResult.jsx';
import StateEntry from './StateEntry.jsx';

export const typeLabels = { choice: 'Choice', noul: 'Yes / no', score: 'Score' };

export default function DecisionForm({
    onSubmit,
    initialState = initialFormState,
    busy = false,
    error = null,
    result = null,
    onDismissResult = () => {},
    submitAccessory = null,
}) {
    const [form, dispatch] = useReducer(decisionFormReducer, initialState);
    function handleSubmit(event) {
        event.preventDefault();
        onSubmit(form);
    }
    const decideButtonLabel = busy ? 'Deciding…' : 'Decide';
    const decideButton = (
        <button type="submit" className="primary" disabled={busy}>
            {decideButtonLabel}
        </button>
    );

    return (
        <>
            <form className="decision-form" onSubmit={handleSubmit}>
                <StateEntry state={form.state} dispatch={dispatch} />

                {submitAccessory ? (
                    <div className="submit-row">
                        {decideButton}
                        {submitAccessory}
                    </div>
                ) : (
                    decideButton
                )}

                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                {result && <DecisionResult result={result} onClose={onDismissResult} />}

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
