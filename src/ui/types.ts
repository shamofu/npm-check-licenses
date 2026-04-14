export type NoticeKind = 'not-found' | 'network' | 'corrected' | 'undefined'

export interface Notice {
  id: string
  kind: NoticeKind
  packageName: string
  detail?: string
}

export type StepStatus = 'running' | 'success' | 'fail'

export interface StepState {
  id: string
  status: StepStatus
  label: string
}
