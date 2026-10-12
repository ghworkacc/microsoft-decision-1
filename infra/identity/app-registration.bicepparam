using './app-registration.bicep'

param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param spaRedirectUris = split(
  readEnvironmentVariable(
    'SPA_REDIRECT_URIS',
    'http://localhost:5173,https://ghworkacc.github.io/microsoft-decision-1-example/'
  ),
  ','
)
