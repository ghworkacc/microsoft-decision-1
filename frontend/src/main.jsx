import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EventType, PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig.js';
import { missingConfig } from './config.js';
import App from './App.jsx';
import '../assets/css/styles.css';

const root = createRoot(document.getElementById('root'));

if (missingConfig.length > 0) {
    root.render(
        <div className="app">
            <p className="error" role="alert">
                Missing configuration: {missingConfig.join(', ')}. Run <code>azd provision</code> to
                generate <code>frontend/.env.local</code>, then restart the dev server.
            </p>
        </div>,
    );
} else {
    const msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
        msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
    }

    msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
            msalInstance.setActiveAccount(event.payload.account);
        }
    });

    root.render(
        <StrictMode>
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        </StrictMode>,
    );
}
