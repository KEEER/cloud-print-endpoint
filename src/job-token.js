import { createVerify, createSign } from 'crypto'
import assert from 'assert'
import { REMOTE_KEY, SIGN_HASH_METHOD, ENDPOINT_KEY, JOB_CLEAN_INTERVAL, JOB_TIMEOUT } from './consts'
import { isValidCode, db, pathFromName } from './util'
import log from './log'
import { unlink as unlinkCb } from 'fs'
import { promisify } from 'util'
const unlink = promisify(unlinkCb)

/**
 * Verifies signature.
 * @param {string} sign signature
 * @param  {...any} data data to sign
 * @returns {boolean} if valid
 */
export function verify (sign, ...data) {
  const verify = createVerify(SIGN_HASH_METHOD)
  for (let d of data) verify.update(d)
  verify.end()
  return verify.verify(REMOTE_KEY, sign, 'hex')
}

/**
 * Signs data.
 * @param  {...any} data data to sign
 * @returns {string} signature
 */
export function sign (...data) {
  const sign = createSign(SIGN_HASH_METHOD)
  for (let d of data) sign.update(d)
  sign.end()
  return sign.sign(ENDPOINT_KEY, 'hex')
}

/** class to represent a print job token. */
export default class JobToken {
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
    assert((await db.find({ nonce })).length === 0, 'nonce used')
    return true
  }

  /**
   * Writes the nonce of this token to database.
   * @async
   */
  async writeNonce () {
    const res = await db.insert({ nonce: this.nonce })
    log(`[DEBUG] used token ${this.nonce} for ${this.code}`)
    return res
  }
}

setInterval(async () => {
  const time = { $lt: Date.now() - JOB_TIMEOUT }
  for (let file of await db.find({ time })) {
    try {
      await unlink(pathFromName(file.name))
    } catch (e) {
      console.log(`[WARN] removing file ${file.name}: ${e}`)
    }
  }
  const count = await db.remove({ time })
  if (count) log(`[DEBUG] cleared file records * ${count}`)
}, JOB_CLEAN_INTERVAL)
