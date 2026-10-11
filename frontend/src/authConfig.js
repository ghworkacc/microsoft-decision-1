import { config } from './config.js';

// Foundry data-plane token audience (Cognitive Services).
export const FOUNDRY_SCOPES = ['https://cognitiveservices.azure.com/.default'];

export const msalConfig = {
    auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
    },
};

export const loginRequest = {
    scopes: FOUNDRY_SCOPES,
};
