import { CODE_DIGITS } from './consts'
import { networkInterfaces } from 'os'
import Datastore from 'nedb-promise'
import path from 'path'

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
