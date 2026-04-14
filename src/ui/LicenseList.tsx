import { Box, Text } from 'ink'

interface LicenseListProps {
  licenses: string[]
}

export function LicenseList({ licenses }: LicenseListProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        You should check {licenses.length} license{licenses.length >= 2 ? 's' : ''} below.
      </Text>
      {licenses.map((id) => (
        <Text key={id}>  {id}</Text>
      ))}
    </Box>
  )
}
