function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

export default function DecisionResult({ result }) {
    return (
        <section className="decision-result" aria-live="polite">
            <h2>
                Decision: <span className="choice">{result.choiceLabel}</span>
            </h2>
            <p className="confidence">Confidence {percent(result.confidence)}</p>
            <ul className="probabilities">
                {result.options.map((option) => (
                    <li key={option.key} className={option.key === result.choiceKey ? 'chosen' : undefined}>
                        <span className="option-label">{option.label}</span>
                        <span className="bar">
                            <span className="bar-fill" style={{ width: percent(option.probability) }} />
                        </span>
                        <span className="option-value">{percent(option.probability)}</span>
                    </li>
                ))}
            </ul>
            {result.usage && (
                <p className="usage">
                    Tokens: {result.usage.input_tokens} in / {result.usage.output_tokens} out
                </p>
            )}
        </section>
    );
}
