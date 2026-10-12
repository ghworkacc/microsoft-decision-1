// Runtime configuration, inlined by Vite from frontend/.env.local
// (written by the azd postprovision hook from frontend/.env.template).
const env = import.meta.env;

export const config = {
    clientId: env.VITE_ENTRA_CLIENT_ID ?? '',
    tenantId: env.VITE_ENTRA_TENANT_ID ?? '',
    foundryEndpoint: (env.VITE_FOUNDRY_ENDPOINT ?? '').replace(/\/+$/, ''),
    deploymentName: env.VITE_DECISION_DEPLOYMENT ?? '',
    // Anonymous mode skips sign-in and calls the rate-limited Function proxy.
    anonymousMode: (env.VITE_ANONYMOUS_MODE ?? '').trim().toLowerCase() === 'true',
    proxyUrl: (env.VITE_DECISION_PROXY_URL ?? '').replace(/\/+$/, ''),
};

const required = config.anonymousMode
    ? {
          VITE_DECISION_PROXY_URL: config.proxyUrl,
          VITE_DECISION_DEPLOYMENT: config.deploymentName,
      }
    : {
          VITE_ENTRA_CLIENT_ID: config.clientId,
          VITE_ENTRA_TENANT_ID: config.tenantId,
          VITE_FOUNDRY_ENDPOINT: config.foundryEndpoint,
          VITE_DECISION_DEPLOYMENT: config.deploymentName,
      };

export const missingConfig = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
