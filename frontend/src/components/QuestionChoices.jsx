export default function QuestionChoices({ question, index, itemName, dispatch }) {
    return (
        <div className="choices">
            <span className="field-label">
                {question.type === 'score' ? 'Levels (lowest to highest)' : 'Choices'}
            </span>
            <ol>
                {question.choices.map((choice, choiceIndex) => (
                    <li key={`${question.id}-${choiceIndex}`}>
                        <input
                            type="text"
                            aria-label={`${itemName[0].toUpperCase()}${itemName.slice(1)} ${index + 1}.${choiceIndex + 1}`}
                            value={choice}
                            onChange={(event) =>
                                dispatch({
                                    type: 'setChoice',
                                    id: question.id,
                                    index: choiceIndex,
                                    value: event.target.value,
                                })
                            }
                        />
                        <button
                            type="button"
                            className="icon-button"
                            aria-label={`Remove ${itemName} ${choiceIndex + 1}`}
                            onClick={() =>
                                dispatch({
                                    type: 'removeChoice',
                                    id: question.id,
                                    index: choiceIndex,
                                })
                            }
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ol>
            <div className="choice-actions">
                <button
                    type="button"
                    onClick={() => dispatch({ type: 'addChoice', id: question.id })}
                >
                    Add {itemName}
                </button>
                <button
                    type="button"
                    onClick={() => dispatch({ type: 'clearChoices', id: question.id })}
                >
                    Clear all
                </button>
            </div>
        </div>
    );
}
