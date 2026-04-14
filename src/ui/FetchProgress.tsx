import { Box, Static, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { Notice } from './types.js'
import { Step } from './Step.js'

interface FetchProgressProps {
  current: string | null
  notices: Notice[]
  done: boolean
}

function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case 'not-found':
      return `License Not Found: ${notice.packageName}`
    case 'network':
      return `Network Error: ${notice.packageName}`
    case 'corrected':
      return `License Corrected: ${notice.packageName} (${notice.detail ?? ''})`
    case 'undefined':
      return `License Undefined: ${notice.packageName} (${notice.detail ?? ''})`
  }
}

export function FetchProgress({ current, notices, done }: FetchProgressProps) {
  return (
    <>
      <Static items={notices}>
        {(notice) => (
          <Box key={notice.id}>
            <Text color="red">✖ </Text>
            <Text>{noticeText(notice)}</Text>
          </Box>
        )}
      </Static>
      {done ? (
        <Step status="success" label="Getting Licenses" />
      ) : (
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> {current ?? 'Getting Licenses'}</Text>
        </Box>
      )}
    </>
  )
}
