import { existsSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import isOnline from 'is-online'
import valid from 'spdx-expression-validate'
import correct from 'spdx-correct'
import type { Notice } from './types.js'

interface PackageJson {
  dependencies?: Record<string, string>
}

interface NpmRegistryResponse {
  license?: string
}

export function readPackageJson(wd: string): PackageJson {
  const content = readFileSync(join(wd, 'package.json'), 'utf-8')
  return JSON.parse(content) as PackageJson
}

export async function fetchLicense(
  packageName: string,
  versionRange: string
): Promise<{ license: string; notice?: Notice }> {
  const encodedName = packageName.replace('/', '%2F')
  const version = versionRange.replace(/^[^0-9]*/, '')
  const url = `https://registry.npmjs.org/${encodedName}/${version}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return {
        license: 'unknown',
        notice: { id: `${packageName}:not-found`, kind: 'not-found', packageName },
      }
    }
    const data = await res.json() as NpmRegistryResponse
    return { license: data.license ?? 'unknown' }
  } catch {
    return {
      license: 'error',
      notice: { id: `${packageName}:network`, kind: 'network', packageName },
    }
  }
}

export function normalizeLicense(
  packageName: string,
  rawLicense: string
): { normalized: string | null; notice?: Notice } {
  if (rawLicense === 'unknown' || rawLicense === 'error') return { normalized: null }
  if (valid(rawLicense)) return { normalized: rawLicense }
  const corrected = correct(rawLicense)
  if (corrected) {
    return {
      normalized: corrected,
      notice: {
        id: `${packageName}:corrected`,
        kind: 'corrected',
        packageName,
        detail: `${rawLicense} => ${corrected}`,
      },
    }
  }
  return {
    normalized: null,
    notice: {
      id: `${packageName}:undefined`,
      kind: 'undefined',
      packageName,
      detail: rawLicense,
    },
  }
}

export type PipelineEvent =
  | { type: 'preflight-start'; id: string; label: string }
  | { type: 'preflight-success'; id: string; label?: string }
  | { type: 'preflight-fail'; id: string; label?: string }
  | { type: 'fetch-phase-start' }
  | { type: 'fetch-current'; packageName: string }
  | { type: 'fetch-notice'; notice: Notice }
  | { type: 'fetch-phase-done' }
  | { type: 'finished'; uniqueLicenses: string[] }
  | { type: 'aborted'; message: string }

export async function runPipeline(
  cd: string,
  pathArg: string,
  emit: (event: PipelineEvent) => void
): Promise<void> {
  const wd = pathArg ? join(cd, pathArg) : cd
  const wdLabel = `.${sep + relative(cd, wd)}`

  // Step 1: Verify package.json exists
  emit({ type: 'preflight-start', id: 'package', label: 'Package Existence' })
  if (!existsSync(join(wd, 'package.json'))) {
    emit({ type: 'preflight-fail', id: 'package', label: `Package Existence (${wdLabel})` })
    emit({ type: 'aborted', message: `package.json not found at ${wdLabel}` })
    return
  }
  emit({ type: 'preflight-success', id: 'package', label: `Package Existence (${wdLabel})` })

  // Step 2: Network connectivity
  emit({ type: 'preflight-start', id: 'network', label: 'Network Connection' })
  const connectivity = await isOnline()
  if (!connectivity) {
    emit({ type: 'preflight-fail', id: 'network' })
    emit({ type: 'aborted', message: 'No network connectivity' })
    return
  }
  emit({ type: 'preflight-success', id: 'network' })

  // Step 3: Load dependencies
  emit({ type: 'preflight-start', id: 'deps', label: 'Loading Dependencies' })
  const jsonObj = readPackageJson(wd)
  if (!jsonObj.dependencies || Object.keys(jsonObj.dependencies).length === 0) {
    emit({ type: 'preflight-fail', id: 'deps' })
    emit({ type: 'aborted', message: 'No Dependency Found' })
    return
  }
  emit({ type: 'preflight-success', id: 'deps' })

  // Step 4: Fetch & normalize licenses
  emit({ type: 'fetch-phase-start' })
  const rawLicenses: string[] = []
  for (const [dep, versionRange] of Object.entries(jsonObj.dependencies)) {
    emit({ type: 'fetch-current', packageName: dep })
    const { license, notice: fetchNotice } = await fetchLicense(dep, versionRange)
    if (fetchNotice) emit({ type: 'fetch-notice', notice: fetchNotice })
    const { normalized, notice: normNotice } = normalizeLicense(dep, license)
    if (normNotice) emit({ type: 'fetch-notice', notice: normNotice })
    if (normalized !== null) rawLicenses.push(normalized)
  }
  emit({ type: 'fetch-phase-done' })

  // Step 5: Deduplicate valid licenses
  const uniqueLicenses = [...new Set(rawLicenses.filter(l => valid(l)))]
  emit({ type: 'finished', uniqueLicenses })
}
