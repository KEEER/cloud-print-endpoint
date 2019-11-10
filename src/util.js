import { CODE_DIGITS } from './consts'
import { createVerify } from 'crypto'

export function isValidCode (code) {
  if (typeof code !== 'string') return false
  if (code.length !== CODE_DIGITS) return false
  if ([...code].some(num => Number.isNaN(Number(num)))) return false
  return true
}

export function verify (pubKey, sign, ...data) {
  const verify = createVerify('sha256')
  for (let d of data) verify.update(d)
  verify.end()
  return verify.verify(pubKey, sign, 'hex')
}
