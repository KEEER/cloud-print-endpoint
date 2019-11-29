/**
 * Lists printer status.
 * @module printerStatus
 * @param {string} printerName full printer name
 * @returns {string} printer details
 */

const printer = require('node-native-printer')
const printerName = require('./checkPrinterName')
console.log(JSON.stringify(printer.printerInfo(printerName)))
