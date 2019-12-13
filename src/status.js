/** @module status */

import EventEmitter from 'events'
import * as consts from './consts'
import log from './log'
import { spawnScript } from './util'

const { BW_PRINTER_NAME, BW_PRINTER_PROFILE, STATUS_UPDATE_INTERVAL, COLORED_PRINTER_PROFILE, COLORED_PRINTER_NAME, JOIN_STATUS } = consts

export const isNormalState = state => state === 'idle' || state === 'printing'

/**
 * EventEmitter to listen on status change.
 * @event update on every status update
 * @event <status> on status <status> detected
 */
class PrinterStatus extends EventEmitter{
  constructor ({
    state = 'unknown',
    message = null,
  } = {}) {
    super()
    this._state = state, this.message = message
    this._becomesList = []
  }

  get state () { return this._state }
  set state (state) {
    if (this.state === state) return
    this._state = state
    this.emit('update')
    this.emit(state)
    this._becomesList = this._becomesList.reduce((prev, curr) => 
      curr.state === state ? (curr.resolve(), prev) : prev.concat([ curr ])
    , [])
    if (!isNormalState(state)) {
      this.emit('error')
      this._becomesList = this._becomesList.reduce((prev, curr) => 
        isNormalState(curr.state) ? (curr.reject(this), prev) : prev.concat([ curr ])
      , [])
    }
  }

  toJSON () {
    return {
      state: this.state,
      message: this.message,
    }
  }

  /**
   * Waits for a certain state.
   * @async
   * @param {string} state which state to wait
   * @param {number} timeout max time to wait before rejection
   */
  becomes (state, timeout) {
    return new Promise((resolve, reject) => {
      if (timeout) setTimeout(reject, timeout, 'Timeout exceeded.')
      this._becomesList.push({ state, resolve, reject })
    })
  }

  equals (that) {
    return that && this.state === that.state && this.message === that.message
  }
}

export const printerStatus = Object.freeze({ bw: new PrinterStatus(), colored: new PrinterStatus() })

export let printerMessage = JOIN_STATUS(printerStatus)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export const status = new EventEmitter()

const updateStatus = async (type, printerName, printerProfile) => {
  try {
    const newStatus = await spawnScript('printer/status', [ printerName, printerProfile ])
    if (!printerStatus[type].equals(newStatus)) {
      printerStatus[type].message = newStatus.message
      printerStatus[type].state = newStatus.state
    }
  } catch (e) {
    log(`[ERROR] update ${type} status ${e && e.stack || e}`)
  }
}

;(async () => {
  await delay(100)
  while (true) {
    await updateStatus('bw', BW_PRINTER_NAME, BW_PRINTER_PROFILE)
    await updateStatus('colored', COLORED_PRINTER_NAME, COLORED_PRINTER_PROFILE)
    printerMessage = JOIN_STATUS(printerStatus)
    await delay(STATUS_UPDATE_INTERVAL)
  }
})()

for (let type of [ 'bw', 'colored' ]) {
  printerStatus[type].on('error', () => log(`[WARN] printer ${type} status ${JSON.stringify(printerStatus[type])}`))
}
