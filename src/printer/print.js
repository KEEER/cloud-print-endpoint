/**
 * Prints a file.
 * returns:
 * - status: 0 indicates ok
 * - message: only if status !== 0
 * @module print
 * @param {string} printerName full printer name
 * @param {string} printerProfile name of printer implementation
 * @param {string} options CUPS options in JSON encoding
 * @param {string} filePath absolute file path
 * @returns {string} see above
 * @see https://www.cups.org/doc/options.html
 * @example node src/printer/print HP_LaserJet_Professional_M1136_MFP '{"page-ranges":"1,2","n":"4"}' files/9ae5326e-40b1-4c32-96ea-08756b0c0117.pdf
 */

const printerName = require('./checkPrinterName')
const [ /* /usr/bin/node */, /* src/printer/print */, /* printerName */, printerProfile, options, filePath ] = process.argv

if(!options || !filePath) {
  console.log(JSON.stringify({
    status: 1,
    message: 'Wrong number of arguments',
  }))
  process.exit(1)
}

let print
try {
  print = require(`./profile/${printerProfile}/print`)
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    message: `Invalid printer profile: ${e}`,
  }))
  process.exit(1)
}

try {
  const res = print(printerName, filePath, JSON.parse(options))
  console.log(JSON.stringify({
    status: 0,
    response: res,
  }))
  process.exit(0)
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    message: e && e.toString(),
  }))
  process.exit(1)
}
