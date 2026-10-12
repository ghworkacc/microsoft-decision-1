// Rate-limited proxy that lets unauthenticated browsers call the decision
// model. Always deployed; the code refuses every request unless the
// ANONYMOUS_MODE app setting is 'true'.
//
// Everything is keyless: the Function app's system-assigned identity reads
// and writes storage, publishes telemetry, and calls Foundry.

@description('Location for all resources.')
param location string

@description('Tags applied to every resource.')
param tags object

@description('Unique suffix for globally-unique resource names.')
@minLength(13)
@maxLength(13)
param resourceToken string

@description('When false, the Function app answers every request with 404.')
param anonymousMode bool

@description('Browser origins allowed by CORS, e.g. https://ghworkacc.github.io.')
param corsAllowedOrigins array

@description('Decision requests allowed per client IP per minute.')
@minValue(1)
param rateLimitPerMinute int

@description('Foundry endpoint, e.g. https://the-new-foundry.services.ai.azure.com.')
param foundryEndpoint string

@description('Model deployment the proxy is allowed to call.')
param decisionDeploymentName string

@description('Upper bound on Function instances, which caps spend under abuse.')
@minValue(1)
@maxValue(1000)
param maximumInstanceCount int = 10

@description('Memory per Function instance.')
@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 2048

var abbrs = loadJsonContent('../abbreviations.json')
var deploymentContainerName = 'deployments'
var rateLimitTableName = 'ratelimits'

var roleIds = {
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
  monitoringMetricsPublisher: '3913510d-42f4-4e42-8a64-420c390055eb'
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${abbrs.insightsComponents}${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableLocalAuth: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${abbrs.storageAccounts}${resourceToken}'
  location: location
  // Opts out of the tenant policy that disables public network access, which
  // otherwise blocks Flex Consumption zip deployments with a 403.
  tags: union(tags, { SecurityControl: 'ignore' })
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }

  resource blobService 'blobServices' = {
    name: 'default'

    resource deploymentContainer 'containers' = {
      name: deploymentContainerName
    }
  }

  resource tableService 'tableServices' = {
    name: 'default'

    resource rateLimitTable 'tables' = {
      name: rateLimitTableName
    }
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${abbrs.webServerFarms}${resourceToken}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: '${abbrs.webSitesFunctions}${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      cors: {
        allowedOrigins: corsAllowedOrigins
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'Authorization=AAD'
        }
        {
          name: 'ANONYMOUS_MODE'
          value: string(anonymousMode)
        }
        {
          name: 'FOUNDRY_ENDPOINT'
          value: foundryEndpoint
        }
        {
          name: 'DECISION_DEPLOYMENT_NAME'
          value: decisionDeploymentName
        }
        {
          name: 'RATE_LIMIT_PER_MINUTE'
          value: string(rateLimitPerMinute)
        }
        {
          name: 'RATE_LIMIT_TABLE_ENDPOINT'
          value: storage.properties.primaryEndpoints.table
        }
        {
          name: 'RATE_LIMIT_TABLE_NAME'
          value: rateLimitTableName
        }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
  }

  // azd deploys with Entra tokens, so publishing credentials stay disabled.
  resource ftpPublishing 'basicPublishingCredentialsPolicies' = {
    name: 'ftp'
    properties: {
      allow: false
    }
  }

  resource scmPublishing 'basicPublishingCredentialsPolicies' = {
    name: 'scm'
    properties: {
      allow: false
    }
  }
}

// Host storage + deployment package container.
resource blobDataOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.id, roleIds.storageBlobDataOwner)
  scope: storage
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleIds.storageBlobDataOwner
    )
  }
}

// Rate-limit counters.
resource tableDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.id, roleIds.storageTableDataContributor)
  scope: storage
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleIds.storageTableDataContributor
    )
  }
}

// Entra-authenticated telemetry ingestion (local auth is disabled).
resource metricsPublisher 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appInsights.id, functionApp.id, roleIds.monitoringMetricsPublisher)
  scope: appInsights
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleIds.monitoringMetricsPublisher
    )
  }
}

output functionAppName string = functionApp.name
output defaultHostName string = functionApp.properties.defaultHostName
output principalId string = functionApp.identity.principalId
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
