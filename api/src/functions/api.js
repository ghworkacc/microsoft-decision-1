import { app } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { createHandlers } from '../lib/handlers.js';
import { RateLimiter } from '../lib/rateLimiter.js';
import { readSettings } from '../lib/settings.js';

const FOUNDRY_SCOPE = 'https://cognitiveservices.azure.com/.default';

const settings = readSettings();
// Managed identity in Azure; `az login` locally.
const credential = new DefaultAzureCredential();
const tableClient = settings.tableEndpoint
    ? new TableClient(settings.tableEndpoint, settings.tableName, credential)
    : null;

const { quota, decision } = createHandlers({
    settings,
    rateLimiter: new RateLimiter({ tableClient, limit: settings.rateLimitPerMinute }),
    getAccessToken: async () => (await credential.getToken(FOUNDRY_SCOPE)).token,
});

// Browser preflights are answered by App Service CORS before reaching these.
app.http('quota', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'quota',
    handler: quota,
});

app.http('decision', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'decision',
    handler: decision,
});
