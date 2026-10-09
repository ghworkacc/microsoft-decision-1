targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment. Used as a prefix for resource names.')
param environmentName string

@description('Primary location for all resources.')
param location string

// Load abbreviations for consistent resource naming
var abbrs = loadJsonContent('./abbreviations.json')
var projectName = 'poc-decide-something'
var tags = {
  'azd-env-name': environmentName
  'azd-project': projectName
}

// Every resource (other than the resource group) needs this globally unique suffix
var suffix = toLower(uniqueString(subscription().id, projectName, environmentName, location))
var rgName = '${abbrs.resourcesResourceGroups}${projectName}-${environmentName}'

// Resource group for all project resources
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: substring(rgName, 0, min(length(rgName), 90)) // don't exceed 90 chars
  location: location
  tags: tags
}

// Example module: Storage Account
// Replace or extend with your own modules in infra/modules/.
module storage './modules/storage.bicep' = {
  scope: rg
  params: {
    storageAccountName: 'default${suffix}'
    location: location
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Outputs
//
// azd captures these as environment variables available to hook scripts
// and in `azd env get-values`.
// ---------------------------------------------------------------------------
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_TENANT_ID string = subscription().tenantId
output STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
