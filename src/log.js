/** @module log */

import { promises as fs } from 'fs'
import stripAnsi from 'strip-ansi'
import { LOGFILE } from './consts.js'

const { appendFile } = fs

/**
 * Makes a log.
 * @param {string} str the string to be logged.
 * @param {any[]} args for koa-logger to call.
 */
export default async function log (str, args) {
  if(!args) args = [ str ]
  console.log(...args)
  await appendFile(LOGFILE || 'server.log', `${Date.now()} ${new Date().toLocaleString()} ${arguments.length === 2 ? '[HTTP]' : ''}${stripAnsi(str)}\n`)
}
