import { CODE_DIGITS } from './consts'
import { networkInterfaces } from 'os'
import Datastore from 'nedb-promise'
import path from 'path'
import JobToken from './job-token'
import log from './log'

/** Main database object. */
export const db = new Datastore({
  filename: process.env.DBFILE,
  autoload: true,
})

/**
 * Validates a print code.
 * @param {string} code code to validate
 */
export function isValidCode (code) {
  if (typeof code !== 'string') return false
  if (code.length !== CODE_DIGITS) return false
  if ([...code].some(num => Number.isNaN(Number(num)))) return false
  return true
}

/** Network address of local machine. */
export const address = Object.values(networkInterfaces()).flat().filter(a => !a.internal && a.family === 'IPv4').map(a => a.address)[0]

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
    await token.writeNonce()
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
