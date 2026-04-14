import { Box, Text } from 'ink'
import { CONDITION_DESCRIPTIONS, type LicenseCondition } from '../license-conditions.js'

interface ConditionsListProps {
  conditions: LicenseCondition[]
}

export function ConditionsList({ conditions }: ConditionsListProps) {
  if (conditions.length === 0) return null
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>Conditions you must satisfy ({conditions.length}):</Text>
      {conditions.map((cond) => {
        const { label, description } = CONDITION_DESCRIPTIONS[cond]
        return (
          <Box key={cond}>
            <Box width={26}>
              <Text>{`  [${label}]`}</Text>
            </Box>
            <Text>{description}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
