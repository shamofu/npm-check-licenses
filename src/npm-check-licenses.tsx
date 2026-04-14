#!/usr/bin/env node

import { createRequire } from 'module'
import { Command } from 'commander'
import { render } from 'ink'
import { App } from './ui/App.js'

const require = createRequire(import.meta.url)
const pkginfo = require('../package.json') as { version: string }

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

  const { waitUntilExit } = render(<App cwd={process.cwd()} pathArg={pathValue} />)

  try {
    await waitUntilExit()
  } catch (err) {
    if (err instanceof Error && err.message) {
      console.error(err.message)
    }
    process.exitCode = 1
  }
}

void main()
