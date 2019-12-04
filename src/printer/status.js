/**
 * Lists printer status.
 * @module printerStatus
 * @param {string} printerName full printer name
 * @param {string} printerProfile name of printer implementation
 * @returns {string} printer details
 */

const printerName = require('./checkPrinterName')

let status
try {
  status = require(`./profile/${process.argv[3]}/status`)
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    message: `Invalid printer profile: ${e}`,
  }))
  process.exit(1)
}

try {
  const res = status(printerName)
  console.log(JSON.stringify({
    status: 0,
    response: res,
  }))
  process.exit(0)
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    message: e.toString(),
  }))
  process.exit(1)
}
