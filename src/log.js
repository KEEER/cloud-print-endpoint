import { appendFile as appendFileCb } from 'fs'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'

const appendFile = promisify(appendFileCb)

/**
 * Makes a log.
 * @param {string} str the string to be logged.
 * @param {any} args[] for koa-logger to call.
 */
export default async function log (str, args) {
  if(!args) args = [ str ]
  console.log(...args)
  await appendFile(process.env.LOGFILE || 'server.log', `${new Date().toLocaleString()} ${stripAnsi(str)}\n`)
}
