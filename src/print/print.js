/**
 * Prints a file.
 * returns:
 * - status: 0 indicates ok
 * - message: only if status !== 0
 * @module print
 * @param {string} printerName full printer name
 * @param {string} options CUPS options in JSON encoding
 * @param {string} filePath absolute file path
 * @returns {object} see abov4
 * @see https://www.cups.org/doc/options.html
 * @example node src/print/print HP_LaserJet_Professional_M1136_MFP '{"page-ranges":"1,2","num-copies":"4"}' files/9ae5326e-40b1-4c32-96ea-08756b0c0117.pdf
 */

const printer = require('node-native-printer')

const [ /* /usr/bin/node */, /* print/print */ , printerName, options, filePath ] = process.argv

if(!printerName || !options || !filePath) {
  console.log(JSON.stringify({
    status: 1,
    message: 'Wrong number of arguments',
  }))
  process.exit(1)
}

if (!printer.listPrinters().find(p => p.name === printerName)) {
  console.log(JSON.stringify({
    status: 1,
    message: 'Printer not found',
  }))
  process.exit(1)
}

try {
  const res = printer.print(filePath, JSON.parse(options), printerName)
  if (!res) throw 'No result from CUPS'
  console.log(JSON.stringify({
    status: 0,
    message: res,
  }))
  process.exit(0)
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    message: e.toString(),
  }))
  process.exit(1)
}
