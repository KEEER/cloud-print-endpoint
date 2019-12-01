/**
 * Lists printer status.
 * @module printerStatus
 * @param {string} printerName full printer name
 * @returns {string} printer details
 */

const printer = require('node-native-printer')
const printerName = require('./checkPrinterName')
console.log(JSON.stringify({
  status: 0,
  response: printer.printerInfo(printerName),
}))
