#!/usr/bin/env node

import { createRequire } from 'module'
import { existsSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import isOnline from 'is-online'
import { Command } from 'commander'
import ora, { type Ora } from 'ora'
import valid from 'spdx-expression-validate'
import correct from 'spdx-correct'
import { computeAllConditions, CONDITION_DESCRIPTIONS } from './license-conditions.js'

const require = createRequire(import.meta.url)
const pkginfo = require('../package.json') as { version: string }

interface PackageJson {
  dependencies?: Record<string, string>
}

interface NpmRegistryResponse {
  license?: string
}

function readPackageJson(wd: string): PackageJson {
  const content = readFileSync(join(wd, 'package.json'), 'utf-8')
  return JSON.parse(content) as PackageJson
}

async function fetchLicense(
  packageName: string,
  versionRange: string,
  spinner: Ora
): Promise<string> {
  const encodedName = packageName.replace('/', '%2F')
  // Strip leading range prefixes (^, ~, >=, etc.) to get the bare version
  const version = versionRange.replace(/^[^0-9]*/, '')
  const url = `https://registry.npmjs.org/${encodedName}/${version}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      spinner.fail(`License Not Found: ${packageName}`)
      return 'unknown'
    }
    const data = await res.json() as NpmRegistryResponse
    return data.license ?? 'unknown'
  } catch {
    spinner.fail(`Network Error: ${packageName}`)
    return 'error'
  }
}

function normalizeLicense(
  packageName: string,
  rawLicense: string,
  spinner: Ora
): string | null {
  if (rawLicense === 'unknown' || rawLicense === 'error') return null
  if (valid(rawLicense)) return rawLicense
  const corrected = correct(rawLicense)
  if (corrected) {
    spinner.fail(`License Corrected: ${packageName} (${rawLicense} => ${corrected})`)
    return corrected
  }
  spinner.fail(`License Undefined: ${packageName} (${rawLicense})`)
  return null
}

async function getAllLicenses(dependencies: Record<string, string>): Promise<string[]> {
  const spinner = ora('Getting Licenses').start()
  const licenses: string[] = []

  for (const [dep, versionRange] of Object.entries(dependencies)) {
    spinner.text = dep
    const rawLicense = await fetchLicense(dep, versionRange, spinner)
    const normalized = normalizeLicense(dep, rawLicense, spinner)
    if (normalized !== null) {
      licenses.push(normalized)
    }
    if (!spinner.isSpinning) {
      spinner.start('Getting Licenses')
    }
  }

  spinner.succeed('Getting Licenses')
  return licenses
}

async function main(): Promise<void> {
  const program = new Command()
  let pathValue = ''

  program
    .version(pkginfo.version, '-v, --version')
    .argument('[path]', 'relative path to target package')
    .action((p: string | undefined) => {
      pathValue = p ?? ''
    })
  program.parse(process.argv)

  // Step 1: Verify package.json exists
  const jsonSpinner = ora('Package Existence').start()
  const cd = process.cwd()
  const wd = pathValue ? join(cd, pathValue) : cd
  if (!existsSync(join(wd, 'package.json'))) {
    jsonSpinner.fail(`Package Existence (.${sep + relative(cd, wd)})`)
    process.exit(1)
  }
  jsonSpinner.succeed(`Package Existence (.${sep + relative(cd, wd)})`)

  // Step 2: Check network connectivity
  const connectivitySpinner = ora('Network Connection').start()
  const connectivity = await isOnline()
  if (!connectivity) {
    connectivitySpinner.fail('Network Connection')
    process.exit(1)
  }
  connectivitySpinner.succeed()

  // Step 3: Load dependencies
  const dependencySpinner = ora('Loading Dependencies').start()
  const jsonObj = readPackageJson(wd)
  if (!jsonObj.dependencies || Object.keys(jsonObj.dependencies).length === 0) {
    dependencySpinner.fail('Loading Dependencies')
    console.error('Error: No Dependency Found')
    process.exit(1)
  }
  dependencySpinner.succeed()

  // Step 4: Fetch and normalize licenses
  const rawLicenses = await getAllLicenses(jsonObj.dependencies)

  // Step 5: Deduplicate valid licenses
  const uniqueLicenses = [...new Set(rawLicenses.filter(l => valid(l)))]

  // Step 6: Display license list
  console.log()
  console.log(`You should check ${uniqueLicenses.length} license${uniqueLicenses.length >= 2 ? 's' : ''} below.`)
  for (const id of uniqueLicenses) {
    console.log(`  ${id}`)
  }

  // Step 7: Compute and display conditions based on license inclusion relationships
  const conditions = computeAllConditions(uniqueLicenses)
  if (conditions.length > 0) {
    console.log()
    console.log(`Conditions you must satisfy (${conditions.length}):`)
    for (const cond of conditions) {
      const { label, description } = CONDITION_DESCRIPTIONS[cond]
      console.log(`  [${label}]`.padEnd(26) + description)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
