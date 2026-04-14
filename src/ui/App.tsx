import { useEffect, useReducer, useRef } from 'react'
import { Box, Static, useApp } from 'ink'
import { computeAllConditions } from '../license-conditions.js'
import { Step } from './Step.js'
import { FetchProgress } from './FetchProgress.js'
import { LicenseList } from './LicenseList.js'
import { ConditionsList } from './ConditionsList.js'
import { runPipeline, type PipelineEvent } from './pipeline.js'
import type { Notice, StepState } from './types.js'

interface AppProps {
  cwd: string
  pathArg: string
}

interface State {
  settledSteps: StepState[]
  activeStep: StepState | null
  fetchPhase: 'pending' | 'running' | 'done'
  currentDep: string | null
  notices: Notice[]
  uniqueLicenses: string[] | null
  errorMessage: string | null
}

const initialState: State = {
  settledSteps: [],
  activeStep: null,
  fetchPhase: 'pending',
  currentDep: null,
  notices: [],
  uniqueLicenses: null,
  errorMessage: null,
}

function reducer(state: State, event: PipelineEvent): State {
  switch (event.type) {
    case 'preflight-start':
      return {
        ...state,
        activeStep: { id: event.id, status: 'running', label: event.label },
      }
    case 'preflight-success': {
      const label = event.label ?? state.activeStep?.label ?? event.id
      return {
        ...state,
        settledSteps: [...state.settledSteps, { id: event.id, status: 'success', label }],
        activeStep: null,
      }
    }
    case 'preflight-fail': {
      const label = event.label ?? state.activeStep?.label ?? event.id
      return {
        ...state,
        settledSteps: [...state.settledSteps, { id: event.id, status: 'fail', label }],
        activeStep: null,
      }
    }
    case 'fetch-phase-start':
      return { ...state, fetchPhase: 'running' }
    case 'fetch-current':
      return { ...state, currentDep: event.packageName }
    case 'fetch-notice':
      return { ...state, notices: [...state.notices, event.notice] }
    case 'fetch-phase-done':
      return { ...state, fetchPhase: 'done', currentDep: null }
    case 'finished':
      return { ...state, uniqueLicenses: event.uniqueLicenses }
    case 'aborted':
      return { ...state, errorMessage: event.message }
    default:
      return state
  }
}

export function App({ cwd, pathArg }: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { exit } = useApp()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      try {
        await runPipeline(cwd, pathArg, dispatch)
      } catch (err) {
        exit(err instanceof Error ? err : new Error(String(err)))
        return
      }
    })()
  }, [cwd, pathArg, exit])

  useEffect(() => {
    if (state.errorMessage !== null) {
      exit(new Error(state.errorMessage))
    } else if (state.uniqueLicenses !== null) {
      exit()
    }
  }, [state.errorMessage, state.uniqueLicenses, exit])

  const conditions = state.uniqueLicenses ? computeAllConditions(state.uniqueLicenses) : []

  return (
    <Box flexDirection="column">
      <Static items={state.settledSteps}>
        {(step) => <Step key={step.id} status={step.status} label={step.label} />}
      </Static>
      {state.activeStep && (
        <Step status={state.activeStep.status} label={state.activeStep.label} />
      )}
      {state.fetchPhase !== 'pending' && (
        <FetchProgress
          current={state.currentDep}
          notices={state.notices}
          done={state.fetchPhase === 'done'}
        />
      )}
      {state.uniqueLicenses && <LicenseList licenses={state.uniqueLicenses} />}
      {state.uniqueLicenses && <ConditionsList conditions={conditions} />}
    </Box>
  )
}
