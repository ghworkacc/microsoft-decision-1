using './main.bicep'

param decisionCapacity = int(readEnvironmentVariable('DECISION_CAPACITY', '10'))
