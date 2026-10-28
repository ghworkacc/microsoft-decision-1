# Azure deployment monitoring

These scripts inspect the Function App deployment storage account. They use the Azure CLI and the current `az login` context.

```sh
./monitor/resource-changes.sh
./monitor/network-changes.sh
LOG_ANALYTICS_WORKSPACE_ID=<workspace-guid> ./monitor/activity-log.sh
```

Override `RESOURCE_ID` to inspect another resource. `LOOKBACK_DAYS` applies to `activity-log.sh`; Resource Graph change history is returned according to Azure's retention and `CHANGE_LIMIT`.
