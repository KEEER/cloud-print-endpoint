import { Configuration } from './util'

/** @module consts */

// use `require` to work in electron
const { createPublicKey, createPrivateKey } = require('crypto')
const { readFileSync } = require('fs')

/** How many digits is in a job code. */
export const CODE_DIGITS = 4
/** The KeyObject of remote public key. */
export const REMOTE_KEY = createPublicKey(readFileSync(process.env.REMOTE_KEYFILE))
/** The KeyObject of endpoint private key. */
export const ENDPOINT_KEY = createPrivateKey(readFileSync(process.env.ENDPOINT_KEYFILE))
/** Hash method to sign and verify data. */
export const SIGN_HASH_METHOD = 'sha256'
/** How often we clean expired jobs from the database. */
export const JOB_CLEAN_INTERVAL = 60 * 1000 // 1 min
/** Hong long is a job for since created. */
export const JOB_TIMEOUT = 24 * 3600 * 1000 // 24 h
/** Default configuration of jobs. */
export const DEFAULT_CONFIG = Object.freeze(new Configuration({
  copies: parseInt(process.env.DEFAULT_COPIES) || 1,
  colored: process.env.DEFAULT_COLORED === 'true',
  'double-sided': process.env.DEFAULT_DOUBLE_SIDED === 'true', // TODO: default to true or false?
}))
/** How often we check for IP changes. */
export const IP_UPDATE_INTERVAL = 10 * 1000 // 10 secs
/** Cloud Print remote base URL. */
export const REMOTE_BASE = process.env.REMOTE_BASE
/** Cloud Print printer ID, for uploading IP to remote. */
export const PRINTER_ID = parseInt(process.env.PRINTER_ID)
/** After this seconds after issuing a job token is invalid. */
export const JOB_TOKEN_TIMEOUT = 60 // 1 min
