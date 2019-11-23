// use `require` to work in electron
const { readFileSync } = require('fs')
const { createPublicKey, createPrivateKey } = require('crypto')

export const CODE_DIGITS = 4
export const REMOTE_KEY = createPublicKey(readFileSync(process.env.REMOTE_KEYFILE))
export const ENDPOINT_KEY = createPrivateKey(readFileSync(process.env.ENDPOINT_KEYFILE))
export const SIGN_HASH_METHOD = 'sha256'
export const JOB_CLEAN_INTERVAL = 60 * 1000 // 1 min
export const JOB_TIMEOUT = 24 * 3600 * 1000 // 24 h
export const DEFAULT_CONFIG = Object.freeze({
  copies: parseInt(process.env.DEFAULT_COPIES) || 1,
  colored: process.env.DEFAULT_COLORED === 'true',
  'double-sided': process.env.DEFAULT_DOUBLE_SIDED === 'true', // TODO: default to true or false?
})
export const IP_UPDATE_INTERVAL = 10 * 1000 // 10 secs
export const REMOTE_BASE = process.env.REMOTE_BASE
export const PRINTER_ID = parseInt(process.env.PRINTER_ID)
