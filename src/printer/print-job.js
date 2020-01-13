/** @module print-job */

import { PrintConfiguration } from '../print-configuration'
import { COLORED_PRINTER_PROFILE, BW_PRINTER_PROFILE } from '../consts'
import log from '../log'
import { normalizeError } from '../util'

/**
 * Prints a file.
 * @async
 * @generator
 * @param {object} fileEntry file entry to be printed
 */
export default function printJob (fileEntry) {
  const config = new PrintConfiguration(fileEntry.config)
  const profile = config.colored ? COLORED_PRINTER_PROFILE : BW_PRINTER_PROFILE
  try {
    const fn = require(`./profile/${profile}/print-job`)
    return fn(fileEntry)
  } catch (e) {
    log(`[ERROR] initialize print job: ${normalizeError(e)}`)
  }
}
