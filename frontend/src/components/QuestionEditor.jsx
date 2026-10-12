import { QUESTION_TYPES } from '../state/decisionForm.js';
import QuestionChoices from './QuestionChoices.jsx';
import { typeLabels } from './DecisionForm.jsx';

export default function QuestionEditor({ question, index, canRemove, dispatch }) {
    const itemName = question.type === 'score' ? 'level' : 'choice';
    const handleQuestionChange = (event) =>
        dispatch({ type: 'setInstructions', id: question.id, value: event.target.value });

    // Nouls don't have any choices to show.
    const showChoices = question.type !== 'noul';

    return (
        <fieldset className="field question-editor">
            <legend className="field-label">Question {index + 1}</legend>
            <div className="question-heading">
                <label className="question-type">
                    <span className="field-label">Type</span>
                    <select
                        aria-label={`Question ${index + 1} type`}
                        value={question.type}
                        onChange={(event) =>
                            dispatch({
                                type: 'setType',
                                id: question.id,
                                value: event.target.value,
                            })
                        }
                    >
                        {QUESTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {typeLabels[type]}
                            </option>
                        ))}
                    </select>
                </label>
                {canRemove && (
                    <button
                        type="button"
                        className="subtle-button"
                        onClick={() => dispatch({ type: 'removeQuestion', id: question.id })}
                    >
                        Remove question
                    </button>
                )}
            </div>
            <label className="field">
                <span className="field-label">Question</span>
                <input
                    className="question-input"
                    type="text"
                    aria-label={`Question ${index + 1}`}
                    value={question.instructions}
                    onChange={handleQuestionChange}
                />
            </label>
            {showChoices && (
                <QuestionChoices
                    question={question}
                    index={index}
                    itemName={itemName}
                    dispatch={dispatch}
                />
            )}
        </fieldset>
    );
}
