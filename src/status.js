/** @module status */

import EventEmitter from 'events'
import * as consts from './consts'
import log from './log'
import { spawnScript } from './util'

const { BW_PRINTER_NAME, BW_PRINTER_PROFILE, STATUS_UPDATE_INTERVAL, COLORED_PRINTER_PROFILE, COLORED_PRINTER_NAME, JOIN_STATUS } = consts

export let printerStatus = { bw: 'unknown', colored: 'unknown' }
export let printerMessage = JOIN_STATUS(printerStatus)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * EventEmitter to listen on status change.
 * @event update on every status update
 * @event <status> on status <status> detected
 * @event <type>:update on (bw / colored) status update
 * @event <type>:<status> combination of the above
 */
export const status = new EventEmitter()

const updateStatus = async (type, printerName, printerProfile) => {
  try {
    const newStatus = await spawnScript('printer/status', [ printerName, printerProfile ])
    if (printerStatus[type] !== newStatus) {
      status.emit('update')
      status.emit(newStatus)
      status.emit(`${type}:update`)
      status.emit(`${type}:${newStatus}`)
      printerStatus[type] = newStatus
    }
  } catch (e) {
    log(`[ERROR] update ${type} status ${e && e.stack || e}`)
  }
}

;(async () => {
  while (true) {
    await updateStatus('bw', BW_PRINTER_NAME, BW_PRINTER_PROFILE)
    await updateStatus('colored', COLORED_PRINTER_NAME, COLORED_PRINTER_PROFILE)
    printerMessage = JOIN_STATUS(printerStatus)
    await delay(STATUS_UPDATE_INTERVAL)
  }
})()
