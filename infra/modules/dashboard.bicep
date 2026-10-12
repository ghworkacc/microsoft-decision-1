// Shared Azure portal dashboard charting anonymous proxy traffic per minute.

@description('Location for the dashboard resource.')
param location string

@description('Tags applied to the dashboard.')
param tags object

@description('Dashboard resource name.')
param name string

@description('Display title shown in the portal.')
param title string

@description('Application Insights component the tiles query.')
param appInsightsId string

var tiles = [
  {
    title: 'Requests per minute by status code'
    query: 'requests\n| summarize Requests = count() by bin(timestamp, 1m), resultCode\n| render timechart'
    splitBy: 'resultCode'
    x: 0
    y: 0
  }
  {
    title: 'Requests per minute by function'
    query: 'requests\n| summarize Requests = count() by bin(timestamp, 1m), name\n| render timechart'
    splitBy: 'name'
    x: 6
    y: 0
  }
  {
    title: 'Rate-limited (429) requests per minute'
    query: 'requests\n| where resultCode == "429"\n| summarize Requests = count() by bin(timestamp, 1m), name\n| render timechart'
    splitBy: 'name'
    x: 0
    y: 4
  }
]

resource dashboard 'Microsoft.Portal/dashboards@2020-09-01-preview' = {
  name: name
  location: location
  tags: union(tags, { 'hidden-title': title })
  properties: {
    lenses: [
      {
        order: 0
        parts: [
          for (tile, i) in tiles: {
            position: {
              x: tile.x
              y: tile.y
              colSpan: 6
              rowSpan: 4
            }
            metadata: {
              // The resource type only models Markdown parts; Logs parts are valid at deploy time.
              #disable-next-line BCP036
              type: 'Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart'
              inputs: [
                {
                  name: 'Scope'
                  value: {
                    resourceIds: [
                      appInsightsId
                    ]
                  }
                  isOptional: true
                }
                {
                  name: 'PartId'
                  value: guid(name, string(i))
                  isOptional: true
                }
                {
                  name: 'Version'
                  value: '2.0'
                  isOptional: true
                }
                {
                  name: 'TimeRange'
                  value: 'PT4H'
                  isOptional: true
                }
                {
                  name: 'Query'
                  value: tile.query
                  isOptional: true
                }
                {
                  name: 'ControlType'
                  value: 'FrameControlChart'
                  isOptional: true
                }
                {
                  name: 'SpecificChart'
                  value: 'Line'
                  isOptional: true
                }
                {
                  name: 'PartTitle'
                  value: tile.title
                  isOptional: true
                }
                {
                  name: 'PartSubTitle'
                  value: last(split(appInsightsId, '/'))
                  isOptional: true
                }
                {
                  name: 'Dimensions'
                  value: {
                    xAxis: {
                      name: 'timestamp'
                      type: 'datetime'
                    }
                    yAxis: [
                      {
                        name: 'Requests'
                        type: 'long'
                      }
                    ]
                    splitBy: [
                      {
                        name: tile.splitBy
                        type: 'string'
                      }
                    ]
                    aggregation: 'Sum'
                  }
                  isOptional: true
                }
                {
                  name: 'LegendOptions'
                  value: {
                    isEnabled: true
                    position: 'Bottom'
                  }
                  isOptional: true
                }
                {
                  name: 'IsQueryContainTimeRange'
                  value: false
                  isOptional: true
                }
              ]
              settings: {}
            }
          }
        ]
      }
    ]
    metadata: {
      model: {
        timeRange: {
          value: {
            relative: {
              duration: 24
              timeUnit: 1
            }
          }
          type: 'MsPortalFx.Composition.Configuration.ValueTypes.TimeRange'
        }
      }
    }
  }
}

output id string = dashboard.id
