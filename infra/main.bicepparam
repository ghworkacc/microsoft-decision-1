using './main.bicep'

param foundryResourceGroupName = readEnvironmentVariable('FOUNDRY_RESOURCE_GROUP_NAME')
param decisionCapacity = int(readEnvironmentVariable('DECISION_CAPACITY', '10'))
param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param location = readEnvironmentVariable('AZURE_LOCATION', 'eastus2')
param anonymousMode = toLower(readEnvironmentVariable('ANONYMOUS_MODE', 'false')) == 'true'
param anonymousCorsOrigins = split(
  readEnvironmentVariable('ANONYMOUS_CORS_ORIGINS', 'https://ghworkacc.github.io,http://localhost:5173'),
  ','
)
param rateLimitPerMinute = int(readEnvironmentVariable('ANONYMOUS_RATE_LIMIT_PER_MINUTE', '5'))
