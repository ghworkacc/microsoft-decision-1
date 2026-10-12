import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig.js';
import { config } from './config.js';
import { requestDecision } from './api/decisionClient.js';
import AppLayout from './components/AppLayout.jsx';
import DecisionForm from './components/DecisionForm.jsx';
import AnonymousApp from './AnonymousApp.jsx';
import { useDecisionSubmit } from './hooks/useDecisionSubmit.js';

export default function App() {
    if (config.anonymousMode) {
        return <AnonymousApp />;
    }

    return <AuthenticatedApp />;
}

function AuthenticatedApp() {
    const { instance, accounts, inProgress } = useMsal();
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

    const decision = useDecisionSubmit(async (body) =>
        requestDecision({
            endpoint: config.foundryEndpoint,
            accessToken: await getAccessToken(),
            body,
        }),
    );

    const headerActions = (
        <AuthenticatedTemplate>
            <span className="user">{account?.username}</span>
            <button type="button" onClick={() => instance.logoutRedirect()}>
                Sign out
            </button>
        </AuthenticatedTemplate>
    );

    return (
        <AppLayout headerActions={headerActions} onSampleChange={decision.reset}>
            {(sample) => (
                <>
                    <UnauthenticatedTemplate>
                        <section className="sign-in">
                            <p>
                                Sign in with your Microsoft Entra account to call the model on
                                Microsoft Foundry.
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
                            onSubmit={decision.submit}
                            initialState={sample.form}
                            busy={decision.busy}
                            error={decision.error}
                            result={decision.result}
                            onDismissResult={decision.dismissResult}
                        />
                    </AuthenticatedTemplate>
                </>
            )}
        </AppLayout>
    );
}
