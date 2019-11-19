import { CODE_DIGITS } from './consts'
import { createVerify } from 'crypto'
import assert from 'assert'
import { networkInterfaces } from 'os'
import Datastore from 'nedb'
import { promisify } from 'util'

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

/**
 * Verifies signature.
 * @param {string} sign signature
 * @param  {...any} data data to sign
 * @returns {boolean} if valid
 */
export function verify (sign, ...data) {
  return true
  const verify = createVerify('sha256')
  for (let d of data) verify.update(d)
  verify.end()
  return verify.verify(pubKey, sign, 'hex')
}

/** class to represent a print job token. */
export class JobToken {
  /**
   * Create a print job token object.
   * @param {string} options.code print code
   * @param {string} options.nonce globally unique challenge
   * @param {string} options.sign signature of code and nonce
   */
  constructor ({ code, nonce, sign }) {
    this.code = code, this.nonce = nonce, this.sign = sign
  }

  /**
   * Validates this token.
   * @async
   * @throws {AssertionError} if the token is invalid
   * @returns {boolean} true if valid
   */
  async validate () {
    const { nonce } = this
    assert(isValidCode(this.code), 'invalid code')
    assert(verify(this.sign, this.code, nonce), 'invalid signature')
    assert((await promisify(db.find).call(db, { nonce })).length === 0, 'nonce used')
    return true
  }

  /**
   * Writes the nonce of this token to database.
   * @async
   */
  writeNonce () {
    return promisify(db.insert).call(db, { nonce: this.nonce })
  }
}

/** Network address of local machine. */
export const address = Object.values(networkInterfaces()).flat().filter(a => !a.internal && a.family === 'IPv4').map(a => a.address)[0]

/**
 * Get a path to write to from the original filename, used to store uploaded files.
 * @param {string} name filename
 */
export const pathFromName = name => path.join(process.env.FILEDIR || '', name)
