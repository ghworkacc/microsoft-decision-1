// Runtime configuration, inlined by Vite from frontend/.env.local
// (written by the azd postprovision hook from frontend/.env.template).
const env = import.meta.env;

export const config = {
    clientId: env.VITE_ENTRA_CLIENT_ID ?? '',
    tenantId: env.VITE_ENTRA_TENANT_ID ?? '',
    foundryEndpoint: (env.VITE_FOUNDRY_ENDPOINT ?? '').replace(/\/+$/, ''),
    deploymentName: env.VITE_DECISION_DEPLOYMENT ?? '',
};

export const missingConfig = Object.entries({
    VITE_ENTRA_CLIENT_ID: config.clientId,
    VITE_ENTRA_TENANT_ID: config.tenantId,
    VITE_FOUNDRY_ENDPOINT: config.foundryEndpoint,
    VITE_DECISION_DEPLOYMENT: config.deploymentName,
}).filter(([, value]) => !value).map(([name]) => name);
