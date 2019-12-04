const printer = require('node-native-printer')

module.exports = function (printerName, filePath, options) {
  const res = printer.print(filePath, options, printerName)
  if (!res) throw 'No result from CUPS'
  return res
}
