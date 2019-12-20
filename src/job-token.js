/** @module job-token */

import assert from 'assert'
import { createVerify, createSign } from 'crypto'
import { promises as fs } from 'fs'
import { REMOTE_KEY, SIGN_HASH_METHOD, ENDPOINT_KEY, JOB_CLEAN_INTERVAL, JOB_TIMEOUT, JOB_TOKEN_TIMEOUT } from './consts'
import log from './log'
import { isValidCode, db, pathFromName } from './util'
const { unlink } = fs

/**
 * Verifies signature.
 * @param {string} sign signature
 * @param  {...Buffer|string} data data to sign
 * @returns {boolean} if valid
 */
export function verify (sign, ...data) {
  const verify = createVerify(SIGN_HASH_METHOD)
  for (let d of data) verify.update(d instanceof Buffer ? d : String(d))
  verify.end()
  return verify.verify(REMOTE_KEY, sign, 'hex')
}

/**
 * Signs data.
 * @param  {...Buffer|string} data data to sign
 * @returns {string} signature
 */
export function sign (...data) {
  const sign = createSign(SIGN_HASH_METHOD)
  for (let d of data) sign.update(d instanceof Buffer ? d : String(d))
  sign.end()
  return sign.sign(ENDPOINT_KEY, 'hex')
}

/** class to represent a print job token. */
export class JobToken {
  /**
   * Create a print job token object.
   * @param {string} options.code print code
   * @param {string} options.timestamp time of server signing request
   * @param {string} options.sign signature of code and timestamp
   */
  constructor ({ code, timestamp, sign }) {
    this.code = code, this.timestamp = Number(timestamp), this.sign = sign
  }

  /**
   * Validates this token.
   * @async
   * @throws {AssertionError} if the token is invalid
   * @returns {boolean} true if valid
   */
  async validate () {
    const { timestamp } = this
    assert(isValidCode(this.code), 'invalid code')
    assert(timestamp + JOB_TOKEN_TIMEOUT > Date.now() / 1000)
    assert(verify(this.sign, this.code, timestamp), 'invalid signature')
    return true
  }
}

/**
 * Cleans job which is expired.
 * @async
 */
const cleanJob = async () => {
  const time = { $lt: Date.now() - JOB_TIMEOUT }
  for (let file of await db.find({ time })) {
    try {
      await unlink(pathFromName(file.id))
    } catch (e) {
      console.log(`[WARN] removing file ${file.id}: ${e}`)
    }
  }
  const count = await db.remove({ time })
  if (count) log(`[DEBUG] cleared file records * ${count}`)
}
setInterval(cleanJob, JOB_CLEAN_INTERVAL)
