import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { StepStatus } from './types.js'

interface StepProps {
  status: StepStatus
  label: string
}

export function Step({ status, label }: StepProps) {
  return (
    <Box>
      {status === 'running' && (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      )}
      {status === 'success' && <Text color="green">✔</Text>}
      {status === 'fail' && <Text color="red">✖</Text>}
      <Text> {label}</Text>
    </Box>
  )
}
