#!/usr/bin/env node

const fs = require('fs')
const isOnline = require('is-online')
const cli = require('commander')
const shell = require('shelljs')
const axios = require('axios')
const ora = require('ora')
const valid = require('spdx-expression-validate')
const correct = require('spdx-correct')

const pkginfo = require('../package.json')

{(async () => {
  cli.version(pkginfo.version, '-v, --version')
  cli.parse(process.argv)

  if (!process.argv.slice(2).length) {
    const jsonSpinner = ora('Package Existence').start()
    const cd = process.cwd()
    if (!fs.existsSync(`${cd}/package.json`)) {
      jsonSpinner.fail()
      shell.exit(1)
    }
    jsonSpinner.succeed()

    const connectivitySpinner = ora('Network Connection').start()
    const connectivity = await isOnline()
    if (!connectivity) {
      connectivitySpinner.fail()
      shell.exit(1)
    }
    connectivitySpinner.succeed()

    const dependencySpinner = ora('Loading Dependencies').start()
    const jsonObj = require(`${cd}/package.json`)
    if (!('dependencies' in jsonObj)) {
      dependencySpinner.fail()
      shell.echo('Error: No Dependency Found')
      shell.exit(1)
    }
    dependencySpinner.succeed()

    const licenseSpinner = ora('Getting Licenses').start()
    const api = 'https://registry.npmjs.org'
    const npm = axios.create({
      baseURL: `${api}/`
    })

    const dependencies = Object.keys(jsonObj.dependencies)
    const licenses = []
    await dependencies.reduce((acc, dep) => {
      return acc.then(() => {
        licenseSpinner.text = dep
        return npm.get(`${encodeURIComponent(dep)}/${encodeURIComponent(jsonObj.dependencies[dep])}`).then((res) => {
          const lic = res.data.license || 'unknown'
          if (lic === 'unknown') {
            licenseSpinner.fail(`License Not Found: ${dep}`)
            licenses.push(lic)
            licenseSpinner.start('Getting Licenses')
          } else {
            if (!valid(lic)) {
              const corrected = correct(lic)
              if (corrected) {
                licenseSpinner.fail(`License Corrected: ${dep} (${lic} => ${corrected})`)
                licenses.push(corrected)
                licenseSpinner.start('Getting Licenses')
              } else {
                licenseSpinner.fail(`License Undefined: ${dep} (${lic})`)
                licenses.push(lic)
                licenseSpinner.start('Getting Licenses')
              }
            } else {
              licenses.push(lic)
            }
          }
        }).catch(() => {
          licenseSpinner.fail(`Network Error: ${dep}`)
          licenses.push('error')
          licenseSpinner.start('Getting Licenses')
        })
      })
    }, Promise.resolve())
    licenseSpinner.succeed('Getting Licenses')

    const filtered = licenses.filter((val, i) => {
      return valid(val) && licenses.indexOf(val) === i
    })

    shell.echo()
    shell.echo(`You should check ${filtered.length} license${filtered.length >= 2 ? 's' : ''} below.`)
    filtered.forEach((id) => {
      shell.echo(`  ${id}`)
    })
  }
})()}
