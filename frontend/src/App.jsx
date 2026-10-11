import { useState } from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig.js';
import { config } from './config.js';
import { buildDecisionRequest, parseDecisionResponse, requestDecision } from './api/decisionClient.js';
import DecisionForm from './components/DecisionForm.jsx';

export default function App() {
    const { instance, accounts, inProgress } = useMsal();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const account = instance.getActiveAccount() ?? accounts[0] ?? null;

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
            const { body, questionsByKey } = buildDecisionRequest({ deploymentName: config.deploymentName, ...form });
            const accessToken = await getAccessToken();
            const payload = await requestDecision({ endpoint: config.foundryEndpoint, accessToken, body });
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
                    <button type="button" onClick={() => instance.logoutRedirect()}>Sign out</button>
                </AuthenticatedTemplate>
            </header>

            <main>
                <UnauthenticatedTemplate>
                    <section className="sign-in">
                        <p>Sign in with your Microsoft Entra account to call the model on Microsoft Foundry.</p>
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
                    <DecisionForm onSubmit={handleSubmit} busy={busy} error={error} result={result} />
                </AuthenticatedTemplate>
            </main>
        </div>
    );
}
