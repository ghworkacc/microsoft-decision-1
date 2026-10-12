// Lets the anonymous proxy's managed identity call the shared Foundry account.
// Deployed into the Foundry resource group, which the stack only references.

@description('Name of the existing Foundry (AIServices) account.')
param accountName string

@description('Principal (object) id of the Function app identity.')
param principalId string

// Cognitive Services User: data-plane inference, no management rights.
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: accountName
}

resource cognitiveServicesUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, principalId, cognitiveServicesUserRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      cognitiveServicesUserRoleId
    )
  }
}
