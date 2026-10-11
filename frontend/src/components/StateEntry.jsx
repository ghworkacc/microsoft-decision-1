export default function StateEntry({ state, dispatch }) {
    const handleChange = (event) => dispatch({ type: 'setState', value: event.target.value });
    return (
        <label className="field">
            <span className="field-label">State</span>
            <textarea rows={8} value={state} onChange={handleChange} />
        </label>
    );
}
