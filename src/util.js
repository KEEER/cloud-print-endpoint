/** @module util */

import { spawn } from 'child_process'
import { networkInterfaces } from 'os'
import path from 'path'
import Datastore from 'nedb-promise'
import fetch from 'node-fetch'
import { CODE_DIGITS, IP_UPDATE_INTERVAL, REMOTE_BASE, PRINTER_ID } from './consts'
import { sign, JobToken } from './job-token'
import log from './log'

/** Main database object. */
export const db = new Datastore({
  filename: process.env.DBFILE,
  autoload: true,
})

/**
 * Validates a print code.
 * @param {string} code code to validate
 * @returns {boolean} whether the code is valid
 */
export function isValidCode (code) {
  if (typeof code !== 'string') return false
  if (code.length !== CODE_DIGITS) return false
  if ([...code].some(num => Number.isNaN(Number(num)))) return false
  return true
}

/** Network address of local machine. */
export let ipAddress
/** Check if IP has changed and report to remote server. */
const updateIp = async () => {
  const newIp = Object.values(networkInterfaces())
    .flat()
    .filter(a => !a.internal && a.family === 'IPv4')
    .map(a => a.address)[0]
  if (ipAddress !== newIp) {
    // handle IP change
    ipAddress = newIp
    try {
      const res = await fetch(new URL('/_api/printer-ip', REMOTE_BASE), {
        method: 'post',
        body: JSON.stringify({
          id: PRINTER_ID, // TODO
          ip: newIp,
          sign: sign(PRINTER_ID.toString(), newIp),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.json())
      if(res.status !== 0) throw res
    } catch (e) {
      log(`[ERROR] updating ip: ${e}`)
    }
  }
}
setInterval(updateIp, IP_UPDATE_INTERVAL)
setTimeout(updateIp, 1)

/**
 * Get a path to write to from the original filename, used to store uploaded files.
 * @param {string} name filename
 */
export const pathFromName = name => path.join(process.env.FILEDIR || '', name)

/**
 * Middleware, gets and validates job token in given context.
 * @async
 * @param {Koa.Context} ctx Koa context
 * @param {function} next Koa next function
 */
export async function getJobToken (ctx, next) {
  const token = new JobToken(JSON.parse(ctx.request.body.token))
  try {
    await token.validate()
  } catch (e) {
    log(`[WARN] bad token: ${e}`)
    ctx.body = {
      status: 1,
      error: 'Invalid token',
      response: null,
    }
    return
  }
  ctx.state.token = token
  return await next()
}

/**
 * Executes script in seperated process and parses its response in JSON format.
 * @async
 * @param {string} script script path to be executed
 * @param {string[]} args spawn arguments
 * @param {number} [timeout] reject after this amount of time
 */
export const spawnScript = (script, args, timeout = 2000) => new Promise((resolve, reject) => {
  setTimeout(reject, timeout)
  const spawnArgs = [ 'node', [ path.resolve(__dirname, script), ...args ] ]
  const parser = spawn(...spawnArgs)
  parser.on('error', reject)
  parser.stdout.on('data', data => {
    try {
      data = JSON.parse(data)
      if(data.status !== 0) throw data
      return resolve(data.response)
    } catch (e) {
      log(`[WARN] script ${script} execution: ${e instanceof Error ? e : JSON.stringify(e)}`)
      reject(e)
    }
  })
})
