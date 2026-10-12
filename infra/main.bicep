targetScope = 'subscription'

// azd deploys this template as a deployment stack (azure.yaml
// infra.deploymentStacks). The stack manages the model deployment, the
// anonymous proxy's resource group (and everything in it), and the proxy's
// role assignment on the Foundry account. The shared Foundry account and its
// resource group are referenced, never declared, so `azd down` leaves them.
//
// The Entra app registration lives in identity/app-registration.bicep because
// deployment stacks don't support the Microsoft Graph extension.

@description('Resource group of the existing, shared Foundry account.')
param foundryResourceGroupName string

@description('Name of the existing, shared Foundry (AIServices) account.')
param foundryAccountName string = 'the-new-foundry'

@description('Model deployment name. Must not contain reserved words such as "Microsoft".')
param decisionDeploymentName string = 'msft-decision-1'

@description('Model deployment SKU.')
@allowed([
  'GlobalStandard'
  'DataZoneStandard'
])
param decisionSkuName string = 'GlobalStandard'

@description('Model deployment capacity (1 unit = 1 request per 60 seconds).')
@minValue(1)
param decisionCapacity int = 60

@description('azd environment name; names the resource group for the anonymous proxy.')
param environmentName string

@description('Location for the anonymous proxy resources.')
param location string

@description('Allow unauthenticated, rate-limited use through the Function app proxy.')
param anonymousMode bool = false

@description('Browser origins allowed to call the anonymous proxy.')
param anonymousCorsOrigins array = [
  'https://ghworkacc.github.io'
  'http://localhost:5173'
]

@description('Anonymous decision requests allowed per client IP per minute.')
@minValue(1)
param rateLimitPerMinute int = 5

var abbrs = loadJsonContent('abbreviations.json')
// The project name keeps this token distinct from other azd projects that use
// the same environment name and location in this subscription.
var resourceToken = toLower(uniqueString(subscription().id, 'poc-decide-something', environmentName, location))
var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${abbrs.resourcesResourceGroups}poc-decide-something-${environmentName}'
  location: location
  tags: tags
}

module decisionDeployment './modules/decision-deployment.bicep' = {
  name: 'poc-decide-something-${decisionDeploymentName}'
  scope: resourceGroup(foundryResourceGroupName)
  params: {
    accountName: foundryAccountName
    deploymentName: decisionDeploymentName
    skuName: decisionSkuName
    capacity: decisionCapacity
  }
}

module anonymousApi './modules/anonymous-api.bicep' = {
  name: 'poc-decide-something-anonymous-api'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    anonymousMode: anonymousMode
    corsAllowedOrigins: anonymousCorsOrigins
    rateLimitPerMinute: rateLimitPerMinute
    foundryEndpoint: decisionDeployment.outputs.endpoint
    decisionDeploymentName: decisionDeployment.outputs.deploymentName
  }
}

module foundryAccess './modules/foundry-role-assignment.bicep' = {
  name: 'poc-decide-something-foundry-access'
  scope: resourceGroup(foundryResourceGroupName)
  params: {
    accountName: foundryAccountName
    principalId: anonymousApi.outputs.principalId
  }
}

module dashboard './modules/dashboard.bicep' = {
  name: 'poc-decide-something-dashboard'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.portalDashboards}${resourceToken}'
    title: 'poc-decide-something (${environmentName}) anonymous requests'
    appInsightsId: anonymousApi.outputs.appInsightsId
  }
}

// ---------------------------------------------------------------------------
// Outputs
//
// azd captures these as environment variables available to hook scripts
// and in `azd env get-values`.
// ---------------------------------------------------------------------------
output AZURE_TENANT_ID string = tenant().tenantId
output FOUNDRY_ENDPOINT string = decisionDeployment.outputs.endpoint
output DECISION_DEPLOYMENT_NAME string = decisionDeployment.outputs.deploymentName
output AZURE_RESOURCE_GROUP string = rg.name
output ANONYMOUS_FUNCTION_APP_NAME string = anonymousApi.outputs.functionAppName
output DECISION_PROXY_URL string = 'https://${anonymousApi.outputs.defaultHostName}/api'
output DASHBOARD_URL string = 'https://portal.azure.com/#@${tenant().tenantId}/dashboard/arm${dashboard.outputs.id}'
