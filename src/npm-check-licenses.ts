#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const isRelative = require('is-relative')
const isOnline = require('is-online')
const cli = require('commander')
const shell = require('shelljs')
const axios = require('axios')
const ora = require('ora')
const valid = require('spdx-expression-validate')
const correct = require('spdx-correct')

const pkginfo = require('../package.json')

let pathValue = ''
{(async () => {
  cli
    .version(pkginfo.version, '-v, --version')
    .arguments('[path]')
    .action((p) => {
      pathValue = p
  })
  cli.parse(process.argv)

  const jsonSpinner = ora('Package Existence').start()
  if (!isRelative(pathValue)) {
    jsonSpinner.fail(`Package Existence (${pathValue} is not a relative path.)`)
    shell.exit(1)
  }
  const cd = process.cwd()
  const wd = pathValue ? path.join(cd, pathValue) : cd
  if (!fs.existsSync(`${wd}/package.json`)) {
    jsonSpinner.fail(`Package Existence (.${path.sep + path.relative(cd, wd)})`)
    shell.exit(1)
  }
  jsonSpinner.succeed(`Package Existence (.${path.sep + path.relative(cd, wd)})`)

  const connectivitySpinner = ora('Network Connection').start()
  const connectivity = await isOnline()
  if (!connectivity) {
    connectivitySpinner.fail()
    shell.exit(1)
  }
  connectivitySpinner.succeed()

  const dependencySpinner = ora('Loading Dependencies').start()
  const jsonObj = require(`${wd}/package.json`)
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
      return npm.get(`${dep.replace('/', '%2F')}/${jsonObj.dependencies[dep].replace('^', '')}`).then((res) => {
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
})()}
