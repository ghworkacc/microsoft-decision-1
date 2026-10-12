import { useState } from 'react';
import * as supportJudge from '../samples/support_judge/index.js';
import * as keepTalking from '../samples/keep_talking/index.js';
import { config } from '../config.js';

const samples = [supportJudge, keepTalking];
const attachmentUrls = import.meta.glob('../../assets/attachments/*.{png,jpg,jpeg,gif,webp}', {
    eager: true,
    import: 'default',
    query: '?url',
});

// Header, sample picker and main area shared by the signed-in and anonymous
// apps. `children` is called with the selected sample.
export default function AppLayout({ headerActions, onSampleChange, children }) {
    const [sampleIndex, setSampleIndex] = useState(0);
    const selectedSample = samples[sampleIndex];

    function selectSample(index) {
        setSampleIndex(index);
        onSampleChange?.();
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>Microsoft-Decision-1</h1>
                {headerActions}
            </header>

            <nav className="sample-nav" aria-label="Sample presets">
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

            {selectedSample.form.attachedImages?.length > 0 && (
                <div className="attached-images" aria-label="Sample attachments">
                    {selectedSample.form.attachedImages.map((image, index) => (
                        <img
                            key={image}
                            src={
                                attachmentUrls[`../../assets/attachments/${image}`] ??
                                `${import.meta.env.BASE_URL}assets/attachments/${image}`
                            }
                            alt={`Attachment ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            <main>{children(selectedSample)}</main>
        </div>
    );
}
