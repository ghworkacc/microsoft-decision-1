import { config } from './config.js';

// Foundry data-plane token audience (Cognitive Services).
export const FOUNDRY_SCOPES = ['https://cognitiveservices.azure.com/.default'];

// Must match an app registration SPA redirect URI exactly: the bare origin
// locally (http://localhost:5173), origin + base path on GitHub Pages.
const baseUrl = import.meta.env.BASE_URL;
const appUrl = baseUrl === '/' ? window.location.origin : `${window.location.origin}${baseUrl}`;

export const msalConfig = {
    auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: appUrl,
        postLogoutRedirectUri: appUrl,
    },
    cache: {
        cacheLocation: 'sessionStorage',
    },
};

export const loginRequest = {
    scopes: FOUNDRY_SCOPES,
};
