import { execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';

export default function setup(project) {
    const env = loadEnv(project.vite.config.mode, project.config.root, 'VITE_');
    const endpoint = (env.VITE_FOUNDRY_ENDPOINT ?? '').replace(/\/+$/, '');
    const deploymentName = env.VITE_DECISION_DEPLOYMENT ?? '';
    const missing = Object.entries({
        VITE_FOUNDRY_ENDPOINT: endpoint,
        VITE_DECISION_DEPLOYMENT: deploymentName,
    })
        .filter(([, value]) => !value)
        .map(([name]) => name);
    if (missing.length > 0) {
        throw new Error(
            `Missing ${missing.join(', ')} in frontend/.env.local. Run 'azd provision' first.`,
        );
    }

    let accessToken;
    try {
        accessToken = execFileSync(
            'az',
            [
                'account',
                'get-access-token',
                '--resource',
                'https://cognitiveservices.azure.com',
                '--query',
                'accessToken',
                '-o',
                'tsv',
            ],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ).trim();
    } catch (error) {
        throw new Error(`Could not get a token from the Azure CLI. Run 'az login' first.`, {
            cause: error,
        });
    }

    project.provide('endpoint', endpoint);
    project.provide('deploymentName', deploymentName);
    project.provide('accessToken', accessToken);
}
