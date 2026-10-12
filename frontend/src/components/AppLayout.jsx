import { useState } from 'react';
import * as supportJudge from '../samples/support_judge/index.js';
import * as keepTalking from '../samples/keep_talking/index.js';
import { config } from '../config.js';

const samples = [supportJudge, keepTalking];

// Header, sample picker and main area shared by the signed-in and anonymous
// apps. `children` is called with the selected sample.
export default function AppLayout({ headerActions, onSampleChange, children }) {
    const [sampleIndex, setSampleIndex] = useState(0);

    function selectSample(index) {
        setSampleIndex(index);
        onSampleChange?.();
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>Decide Something</h1>
                <span className="model">
                    Microsoft-Decision-1 · <code>{config.deploymentName}</code>
                </span>
                {headerActions}
            </header>

            <nav className="sample-nav" aria-label="Sample presets">
                <span className="sample-nav-label">Samples</span>
                <div className="sample-options">
                    {samples.map((item, index) => (
                        <button
                            key={item.name}
                            type="button"
                            className={`sample-option${index === sampleIndex ? ' active' : ''}`}
                            aria-pressed={index === sampleIndex}
                            onClick={() => selectSample(index)}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            </nav>

            <main>{children(samples[sampleIndex])}</main>
        </div>
    );
}
