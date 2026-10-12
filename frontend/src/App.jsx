import { useState } from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig.js';
import { config } from './config.js';
import {
    buildDecisionRequest,
    parseDecisionResponse,
    requestDecision,
} from './api/decisionClient.js';
import DecisionForm from './components/DecisionForm.jsx';
import * as supportJudge from './sample/support_judge/index.js';
import * as keepTalking from './sample/keep_talking/index.js';

const samples = [supportJudge, keepTalking];

export default function App() {
    const { instance, accounts, inProgress } = useMsal();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [sampleIndex, setSampleIndex] = useState(0);

    const account = instance.getActiveAccount() ?? accounts[0] ?? null;
    const sample = samples[sampleIndex];

    function selectSample(index) {
        setSampleIndex(index);
        setResult(null);
        setError(null);
    }

    async function getAccessToken() {
        try {
            const { accessToken } = await instance.acquireTokenSilent({ ...loginRequest, account });
            return accessToken;
        } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
                await instance.acquireTokenRedirect({ ...loginRequest, account });
            }
            throw e;
        }
    }

    async function handleSubmit(form) {
        setError(null);
        setResult(null);
        setBusy(true);
        try {
            const { body, questionsByKey } = buildDecisionRequest({
                deploymentName: config.deploymentName,
                ...form,
            });
            const accessToken = await getAccessToken();
            const payload = await requestDecision({
                endpoint: config.foundryEndpoint,
                accessToken,
                body,
            });
            setResult(parseDecisionResponse(payload, questionsByKey));
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>Decide Something</h1>
                <span className="model">
                    Microsoft-Decision-1 · <code>{config.deploymentName}</code>
                </span>
                <AuthenticatedTemplate>
                    <span className="user">{account?.username}</span>
                    <button type="button" onClick={() => instance.logoutRedirect()}>
                        Sign out
                    </button>
                </AuthenticatedTemplate>
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

            <main>
                <UnauthenticatedTemplate>
                    <section className="sign-in">
                        <p>
                            Sign in with your Microsoft Entra account to call the model on Microsoft
                            Foundry.
                        </p>
                        <button
                            type="button"
                            className="primary"
                            disabled={inProgress !== InteractionStatus.None}
                            onClick={() => instance.loginRedirect(loginRequest)}
                        >
                            Sign in
                        </button>
                    </section>
                </UnauthenticatedTemplate>

                <AuthenticatedTemplate>
                    <DecisionForm
                        key={sample.name}
                        onSubmit={handleSubmit}
                        initialState={sample.form}
                        busy={busy}
                        error={error}
                        result={result}
                        onDismissResult={() => setResult(null)}
                    />
                </AuthenticatedTemplate>
            </main>
        </div>
    );
}
