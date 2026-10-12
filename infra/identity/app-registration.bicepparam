using './app-registration.bicep'

param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param spaRedirectUris = concat(
  [readEnvironmentVariable('FRONTEND_URL', 'http://localhost:5173')],
  empty(readEnvironmentVariable('ADDITIONAL_SPA_REDIRECT', ''))
    ? []
    : [readEnvironmentVariable('ADDITIONAL_SPA_REDIRECT', '')]
)
