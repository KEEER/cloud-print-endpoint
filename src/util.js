import { CODE_DIGITS } from './consts'
import { createVerify } from 'crypto'
import assert from 'assert'
import { networkInterfaces } from 'os'

export function isValidCode (code) {
  if (typeof code !== 'string') return false
  if (code.length !== CODE_DIGITS) return false
  if ([...code].some(num => Number.isNaN(Number(num)))) return false
  return true
}

// TODO: load pubkey
export function verify (sign, ...data) {
  const verify = createVerify('sha256')
  for (let d of data) verify.update(d)
  verify.end()
  return verify.verify(pubKey, sign, 'hex')
}

export class JobToken {
  constructor ({ code, userid, sign, nonce }) {
    assert(isValidCode(code), 'invalid code')
    assert(isValidUserId(userid), 'invalid userid')
    // TODO: validate nonce
    assert(verify(sign, userid, code, nonce), 'invalid signature')
    this.code = code, this.userid = userid, this.sign = sign, this.nonce = nonce
  }
}

export const address = Object.values(networkInterfaces()).flat().filter(a => !a.internal && a.family === 'IPv4').map(a => a.address)[0]
