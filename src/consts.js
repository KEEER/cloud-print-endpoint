// use `require` to work in electron
const { readFileSync } = require('fs')
const { createPublicKey, createPrivateKey } = require('crypto')

export const CODE_DIGITS = 4
export const REMOTE_KEY = createPublicKey(readFileSync(process.env.REMOTE_KEYFILE))
export const ENDPOINT_KEY = createPrivateKey(readFileSync(process.env.ENDPOINT_KEYFILE))
export const SIGN_HASH_METHOD = 'sha256'
export const JOB_CLEAN_INTERVAL = 60 * 1000 // 1 min
export const JOB_TIMEOUT = 24 * 3600 * 1000 // 24 h
