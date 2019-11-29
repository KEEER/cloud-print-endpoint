const [ /* /usr/bin/node */, /* src/printer/status */ , printerName ] = process.argv
const printer = require('node-native-printer')

if(!printerName) {
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

module.exports = printerName
