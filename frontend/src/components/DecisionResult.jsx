function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

function ProbabilityList({ options, chosenKey }) {
    return (
        <ul className="probabilities">
            {options.map((option) => (
                <li key={option.key} className={option.key === chosenKey ? 'chosen' : undefined}>
                    <span className="option-label">{option.label}</span>
                    <span className="bar">
                        <span className="bar-fill" style={{ width: percent(option.probability) }} />
                    </span>
                    <span className="option-value">{percent(option.probability)}</span>
                </li>
            ))}
        </ul>
    );
}

function ResultChoice({ result }) {
    return (
        <section className="decision-result" aria-live="polite">
            <h2>{result.question}</h2>
            <h2>
                <span className="choice">{result.choiceLabel}</span>
            </h2>
            <p className="confidence">Confidence {percent(result.confidence)}</p>
            <ProbabilityList options={result.options} chosenKey={result.choiceKey} />
        </section>
    );
}

function ResultNoul({ result }) {
    const answerLabel = result.confidence >= 0.5 ? 'Yes' : 'No';
    const answerProbability = result.confidence >= 0.5 ? result.confidence : 1 - result.confidence;

    return (
        <section className="decision-result" aria-live="polite">
            <h2>{result.question}</h2>
            <ProbabilityList
                options={[
                    {
                        key: answerLabel.toLowerCase(),
                        label: answerLabel,
                        probability: answerProbability,
                    },
                ]}
            />
        </section>
    );
}

function ResultScore({ result }) {
    return (
        <section className="decision-result" aria-live="polite">
            <h2>{result.question}</h2>
            <h2>
                <span className="choice">{result.scoreLabel}</span>
            </h2>
            <p className="confidence">Score {result.score.toFixed(2)}</p>
            <ProbabilityList options={result.options} />
        </section>
    );
}

function ResultCard({ result }) {
    if (result.type === 'choice') return <ResultChoice result={result} />;
    if (result.type === 'noul') return <ResultNoul result={result} />;
    return <ResultScore result={result} />;
}

export default function DecisionResult({ result, onClose }) {
    return (
        <>
            <div className="decision-results">
                <button
                    type="button"
                    className="icon-button results-close"
                    aria-label="Close results"
                    onClick={onClose}
                >
                    x
                </button>
                {result.results.map((item) => (
                    <ResultCard key={item.key} result={item} />
                ))}
                <p className="usage">
                    Tokens: {result.usage.input_tokens} in / {result.usage.output_tokens} out
                </p>
            </div>
        </>
    );
}
