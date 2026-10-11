@description('Name of the existing Foundry (AIServices) account. It is referenced, never (re)declared.')
param accountName string

@description('Name of the model deployment to create on the account.')
param deploymentName string

@description('Deployment SKU.')
@allowed([
  'GlobalStandard'
  'DataZoneStandard'
])
param skuName string

@description('Deployment capacity (1 unit = 1 request per 60 seconds).')
@minValue(1)
param capacity int

@description('Model format as reported by `az cognitiveservices account list-models`.')
param modelFormat string = 'Microsoft'

@description('Model name.')
param modelName string = 'Microsoft-Decision-1'

@description('Model version.')
param modelVersion string = '1'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: accountName
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: account
  name: deploymentName
  sku: {
    name: skuName
    capacity: capacity
  }
  properties: {
    model: {
      format: modelFormat
      name: modelName
      version: modelVersion
    }
    raiPolicyName: 'Microsoft.DefaultV2'
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

output deploymentName string = deployment.name
// e.g. https://the-new-foundry.services.ai.azure.com (no trailing slash)
output endpoint string = 'https://${account.properties.customSubDomainName}.services.ai.azure.com'
