function percent(value) {
    return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function ProbabilityList({ options, chosenKey }) {
    return <ul className="probabilities">{options.map((option) => <li key={option.key} className={option.key === chosenKey ? 'chosen' : undefined}><span className="option-label">{option.label}</span><span className="bar"><span className="bar-fill" style={{ width: percent(option.probability) }} /></span><span className="option-value">{percent(option.probability)}</span></li>)}</ul>;
}

function ResultCard({ result }) {
    const number = result.key.replace('question_', '');
    if (result.type === 'choice') return <section className="decision-result" aria-live="polite"><h2>Question {number}: <span className="choice">{result.choiceLabel}</span></h2><p className="confidence">Confidence {percent(result.confidence)}</p><ProbabilityList options={result.options} chosenKey={result.choiceKey} /></section>;
    if (result.type === 'noul') return <section className="decision-result" aria-live="polite"><h2>Question {number}: <span className="choice">{result.probability >= 0.5 ? 'Yes' : 'No'}</span></h2><p className="confidence">Yes probability {percent(result.probability)}</p><ProbabilityList options={[{ key: 'yes', label: 'Yes', probability: result.probability }, { key: 'no', label: 'No', probability: 1 - result.probability }]} /></section>;
    return <section className="decision-result" aria-live="polite"><h2>Question {number}: <span className="choice">{result.scoreLabel}</span></h2><p className="confidence">Score {result.score?.toFixed?.(2) ?? result.score}</p><ProbabilityList options={result.options} /></section>;
}

export default function DecisionResult({ result }) {
    return <div className="decision-results">{result.results.map((item) => <ResultCard key={item.key} result={item} />)}{result.usage && <p className="usage">Tokens: {result.usage.input_tokens} in / {result.usage.output_tokens} out</p>}</div>;
}
