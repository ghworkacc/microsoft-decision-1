// Entra ID app registration for the browser SPA (MSAL, auth code + PKCE).
//
// Deployed by the postprovision hook with `az deployment sub create` rather
// than by azd directly: azd deploys infra/main.bicep as a deployment stack,
// and deployment stacks don't support the Microsoft Graph extension.
// Removed by the postdown hook.

extension microsoftGraphV1

targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment. Makes the app registration unique per environment.')
param environmentName string

@description('SPA redirect URIs (local dev server and any production origins).')
param spaRedirectUris array = [
  'http://localhost:5173'
]

var projectName = 'poc-decide-something'

// "Microsoft Cognitive Services" first-party app and its delegated
// `user_impersonation` scope (token audience https://cognitiveservices.azure.com).
var cognitiveServicesAppId = '7d312290-28c8-473c-a0ed-8e53749b6d6d'
var cognitiveServicesUserImpersonationScopeId = '5f1e8914-a52b-429f-9324-91b92b81adaf'

resource app 'Microsoft.Graph/applications@v1.0' = {
  uniqueName: '${projectName}-${environmentName}'
  displayName: '${projectName} (${environmentName})'
  signInAudience: 'AzureADMyOrg'
  spa: {
    redirectUris: spaRedirectUris
  }
  requiredResourceAccess: [
    {
      resourceAppId: cognitiveServicesAppId
      resourceAccess: [
        {
          id: cognitiveServicesUserImpersonationScopeId
          type: 'Scope'
        }
      ]
    }
  ]
}

resource servicePrincipal 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: app.appId
}

output ENTRA_CLIENT_ID string = app.appId
output AZURE_TENANT_ID string = tenant().tenantId
