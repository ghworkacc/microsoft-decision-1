using './app-registration.bicep'

param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param spaRedirectUris = concat(
  split(readEnvironmentVariable('SPA_REDIRECT_URIS', 'http://localhost:5173'), ','),
  [readEnvironmentVariable('FRONTEND_URL', 'http://localhost:5173')]
)
