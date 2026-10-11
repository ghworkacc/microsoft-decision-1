import { useReducer } from 'react';
import { decisionFormReducer, initialFormState, QUESTION_TYPES } from '../state/decisionForm.js';

const typeLabels = { choice: 'Choice', noul: 'Yes / no', score: 'Score' };

function QuestionEditor({ question, index, canRemove, dispatch }) {
    const itemName = question.type === 'score' ? 'level' : 'choice';
    const handleQuestionChange = (event) => dispatch({ type: 'setInstructions', id: question.id, value: event.target.value });

    return (
        <fieldset className="field question-editor">
            <legend className="field-label">Question {index + 1}</legend>
            <div className="question-heading">
                <label className="question-type"><span className="field-label">Type</span><select aria-label={`Question ${index + 1} type`} value={question.type} onChange={(event) => dispatch({ type: 'setType', id: question.id, value: event.target.value })}>{QUESTION_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
                {canRemove && <button type="button" className="subtle-button" onClick={() => dispatch({ type: 'removeQuestion', id: question.id })}>Remove question</button>}
            </div>
            <label className="field">
                <span className="field-label">Question</span>
                <input type="text" aria-label={`Question ${index + 1}`} 
                       value={question.instructions} 
                       onChange={handleQuestionChange} />
            </label>
            {question.type !== 'noul' && <div className="choices"><span className="field-label">{question.type === 'score' ? 'Levels (lowest to highest)' : 'Choices'}</span><ol>{question.choices.map((choice, choiceIndex) => <li key={`${question.id}-${choiceIndex}`}><input type="text" aria-label={`${itemName[0].toUpperCase()}${itemName.slice(1)} ${index + 1}.${choiceIndex + 1}`} value={choice} onChange={(event) => dispatch({ type: 'setChoice', id: question.id, index: choiceIndex, value: event.target.value })} /><button type="button" className="icon-button" aria-label={`Remove ${itemName} ${choiceIndex + 1}`} onClick={() => dispatch({ type: 'removeChoice', id: question.id, index: choiceIndex })}>×</button></li>)}</ol><div className="choice-actions"><button type="button" onClick={() => dispatch({ type: 'addChoice', id: question.id })}>Add {itemName}</button><button type="button" onClick={() => dispatch({ type: 'clearChoices', id: question.id })}>Clear all</button></div></div>}
        </fieldset>
    );
}

export default function DecisionForm({ onSubmit, busy = false }) {
    const [form, dispatch] = useReducer(decisionFormReducer, initialFormState);
    function handleSubmit(event) { event.preventDefault(); onSubmit(form); }
    return <form className="decision-form" onSubmit={handleSubmit}>{form.questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} canRemove={form.questions.length > 1} dispatch={dispatch} />)}<button type="button" onClick={() => dispatch({ type: 'addQuestion' })}>Add question</button><label className="field"><span className="field-label">State</span><textarea rows={8} value={form.state} onChange={(event) => dispatch({ type: 'setState', value: event.target.value })} /></label><button type="submit" className="primary" disabled={busy}>{busy ? 'Deciding…' : 'Decide'}</button></form>;
}
