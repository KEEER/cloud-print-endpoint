/** @module status */

import * as consts from './consts'
import log from './log'
import { spawnScript } from './util'

const { BW_PRINTER_NAME, BW_PRINTER_PROFILE, STATUS_UPDATE_INTERVAL, MESSAGE_FROM_STATUS, COLORED_PRINTER_PROFILE, COLORED_PRINTER_NAME, JOIN_STATUS } = consts

export let printerStatus = { bw: 'unknown', colored: 'unknown' }
export let printerMessage = JOIN_STATUS(printerStatus)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  while (true) {
    try {
      const bwStatus = await spawnScript('printer/status', [ BW_PRINTER_NAME, BW_PRINTER_PROFILE ])
      const coloredStatus = await spawnScript('printer/status', [ COLORED_PRINTER_NAME, COLORED_PRINTER_PROFILE ])
      printerStatus.bw = bwStatus
      printerStatus.colored = coloredStatus
      printerMessage = JOIN_STATUS(printerStatus)
    } catch (e) {
      log(`[ERROR] update status ${e.stack || e}`)
    }
    await delay(STATUS_UPDATE_INTERVAL)
  }
})()
