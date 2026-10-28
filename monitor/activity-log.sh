#!/usr/bin/env bash
set -euo pipefail

: "${RESOURCE_ID:=/subscriptions/cced88a2-54f4-4d00-a458-d6b4cd2cd20d/resourceGroups/rg-poc-decide-something-dev/providers/Microsoft.Storage/storageAccounts/sta52jnvuegllrq}"
: "${LOOKBACK_DAYS:=30}"
: "${LOG_ANALYTICS_WORKSPACE_ID:=}"

command -v az >/dev/null 2>&1 || {
  printf 'error: Azure CLI (az) is required\n' >&2
  exit 1
}

if [[ -z "$LOG_ANALYTICS_WORKSPACE_ID" ]]; then
  printf 'error: set LOG_ANALYTICS_WORKSPACE_ID to the Log Analytics workspace ID\n' >&2
  printf 'hint: az resource show --ids <workspace-resource-id> --query properties.customerId -o tsv\n' >&2
  exit 1
fi

query=$(cat <<KQL
let target = '$RESOURCE_ID';
AzureActivity
| where TimeGenerated > ago(${LOOKBACK_DAYS}d)
| where ResourceId =~ target
| where OperationNameValue has_any ('Microsoft.Storage/storageAccounts/write', 'Microsoft.Storage/storageAccounts/update')
| project TimeGenerated, OperationNameValue, ActivityStatusValue, Caller, CallerIpAddress, CorrelationId, Authorization, Properties
| order by TimeGenerated desc
KQL
)

az monitor log-analytics query \
  --workspace "$LOG_ANALYTICS_WORKSPACE_ID" \
  --analytics-query "$query" \
  --output table
