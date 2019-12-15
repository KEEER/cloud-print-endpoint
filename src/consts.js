/** @module consts */

import { PrintConfiguration } from './print-configuration.js'

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
export const DEFAULT_CONFIG = Object.freeze(new PrintConfiguration({
  copies: parseInt(process.env.DEFAULT_COPIES) || 1,
  colored: process.env.DEFAULT_COLORED === 'true',
  doubleSided: process.env.DEFAULT_DOUBLE_SIDED === 'true',
}))
/** How often we check for IP changes. */
export const IP_UPDATE_INTERVAL = 10 * 1000 // 10 secs
/** Cloud Print remote base URL. */
export const REMOTE_BASE = process.env.REMOTE_BASE
/** Cloud Print printer ID, for uploading IP to remote. */
export const PRINTER_ID = parseInt(process.env.PRINTER_ID)
/** After this seconds after issuing a job token is invalid. */
export const JOB_TOKEN_TIMEOUT = 60 // 1 min
/** Printer name and profile for uncolored prints. */
export const { BW_PRINTER_NAME, BW_PRINTER_PROFILE } = process.env
/** Printer name and profile for colored prints. */
export const { COLORED_PRINTER_NAME, COLORED_PRINTER_PROFILE } = process.env
/** How often we run the printer status script. */
export const STATUS_UPDATE_INTERVAL = 0.5 * 1000 // 0.5 sec
/** Status messages for status codes. */
export const MESSAGE_FROM_STATUS = Object.freeze({
  'cannot-print': '此文件无法打印',
  idle: '待命',
  mechanical: '机械故障',
  'out-of-paper': '缺纸',
  'paper-jam': '卡纸',
  'printer-error': '打印机异常',
  printing: '正在打印',
  unknown: '未知',
  undefined: '未知',
  // TODO
})
/** Join statuses together to get a 'better' status. */
export const JOIN_STATUS = ({ bw, colored }) => `黑白打印机${MESSAGE_FROM_STATUS[bw.state]}${bw.message ? ':' + bw.message : ''}，彩色打印机${MESSAGE_FROM_STATUS[colored.state]}${colored.message ? ':' + colored.message : ''}`
/** Password for accessing the administration interface. */
export const { ADMIN_PASSWORD } = process.env
