targetScope = 'subscription'

// azd deploys this template as a deployment stack (azure.yaml
// infra.deploymentStacks). The stack only manages the model deployment below;
// the shared Foundry account and its resource group are referenced, never
// declared, so `azd down` removes just the model deployment.
//
// The Entra app registration lives in identity/app-registration.bicep because
// deployment stacks don't support the Microsoft Graph extension.

@description('Resource group of the existing, shared Foundry account.')
param foundryResourceGroupName string = 'the-new-foundry'

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
param decisionCapacity int = 10

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

// ---------------------------------------------------------------------------
// Outputs
//
// azd captures these as environment variables available to hook scripts
// and in `azd env get-values`.
// ---------------------------------------------------------------------------
output AZURE_TENANT_ID string = tenant().tenantId
output FOUNDRY_ENDPOINT string = decisionDeployment.outputs.endpoint
output DECISION_DEPLOYMENT_NAME string = decisionDeployment.outputs.deploymentName
