/** @module status */

import EventEmitter from 'events'
import fetch from 'node-fetch'
import * as consts from './consts'
import log from './log'
import { sign } from './job-token'
import { spawnScript, useTimeout } from './util'

const { BW_PRINTER_NAME, BW_PRINTER_PROFILE, STATUS_UPDATE_INTERVAL, COLORED_PRINTER_PROFILE, COLORED_PRINTER_NAME, JOIN_STATUS, PRINT_TIMEOUT, REMOTE_BASE, PRINTER_ID, REMOTE_TIMEOUT } = consts

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
    this.emit('update', this)
    this.emit(state, this)
    this._becomesList = this._becomesList.reduce((prev, curr) => 
      curr.state === state ? (curr.resolve(), prev) : prev.concat([ curr ])
    , [])
    if (!isNormalState(state)) {
      this.emit('error', this)
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
  becomes (state, timeout = PRINT_TIMEOUT) {
    return useTimeout(new Promise((resolve, reject) => {
      this._becomesList.push({ state, resolve, reject })
    }), timeout)
  }

  equals (that) {
    return that && this.state === that.state && this.message === that.message
  }
}

let isHalted = false
export const printerStatus = Object.freeze({
  bw: new PrinterStatus(),
  colored: new PrinterStatus(),
  get halted () { return isHalted },
  set halted (s) { isHalted = s },
})

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
  printerStatus[type].on('error', async () => {
    log(`[WARN] printer ${type} status ${JSON.stringify(printerStatus[type])}`)
    const status = JSON.stringify(printerStatus)
    try {
      const res = await useTimeout(fetch(new URL('/_api/error-report', REMOTE_BASE), {
        method: 'post',
        body: new URLSearchParams({
          status,
          id: PRINTER_ID,
          sign: sign(status, id),
        }),
        headers: { 'Content-Type': 'application/json' },
      }), REMOTE_TIMEOUT, 'Remote connection timeout')
      if (!res || res.status !== 0) throw res
    } catch (e) {
      log(`[ERROR] reporting printer status to remote: ${e instanceof Error ? e.stack : JSON.stringify(e)}`)
    }
  })
}
