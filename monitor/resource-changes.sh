#!/usr/bin/env bash
set -euo pipefail

: "${RESOURCE_ID:=/subscriptions/cced88a2-54f4-4d00-a458-d6b4cd2cd20d/resourceGroups/rg-poc-decide-something-dev/providers/Microsoft.Storage/storageAccounts/sta52jnvuegllrq}"
: "${CHANGE_LIMIT:=1000}"

command -v az >/dev/null 2>&1 || {
  printf 'error: Azure CLI (az) is required\n' >&2
  exit 1
}

query=$(cat <<KQL
resourcechanges
| where tostring(properties.targetResourceId) =~ '$RESOURCE_ID'
| extend
    changeTime = todatetime(properties.changeAttributes.timestamp),
  changeType = tostring(properties.changeType),
    changedBy = tostring(properties.changeAttributes.changedBy),
  changedByType = tostring(properties.changeAttributes.changedByType),
    clientType = tostring(properties.changeAttributes.clientType),
    correlationId = tostring(properties.changeAttributes.correlationId),
    changedProperties = properties.changes
| project changeTime, changeType, changedBy, changedByType, clientType, correlationId, changedProperties
| order by changeTime desc
KQL
)

az graph query --graph-query "$query" --first "$CHANGE_LIMIT" --output json
