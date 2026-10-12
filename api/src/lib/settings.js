export function readSettings(env = process.env) {
    const limit = Number.parseInt(env.RATE_LIMIT_PER_MINUTE ?? '', 10);
    return {
        anonymousMode: (env.ANONYMOUS_MODE ?? '').trim().toLowerCase() === 'true',
        foundryEndpoint: (env.FOUNDRY_ENDPOINT ?? '').replace(/\/+$/, ''),
        deploymentName: env.DECISION_DEPLOYMENT_NAME ?? '',
        rateLimitPerMinute: Number.isInteger(limit) && limit > 0 ? limit : 5,
        tableEndpoint: env.RATE_LIMIT_TABLE_ENDPOINT ?? '',
        tableName: env.RATE_LIMIT_TABLE_NAME || 'ratelimits',
    };
}
