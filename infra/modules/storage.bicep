@description('Name of the storage account. Must be globally unique, 3-24 chars, lowercase letters and numbers only.')
param storageAccountName string

@description('Primary location for the storage account.')
param location string

@description('Tags to apply to the storage account.')
param tags object = {}

@description('Storage account SKU.')
@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_ZRS'
  'Premium_LRS'
])
param sku string = 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output primaryEndpoints object = storageAccount.properties.primaryEndpoints
