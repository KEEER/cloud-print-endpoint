const ipp = require('ipp')
const { promisify } = require('util')
require('ipp/lib/parser').handleUnknownTag = () => {}

const errorCodeMapping = {
  1000: 'out-of-paper',
  1300: 'paper-jam',
  4100: 'cannot-print',
  4102: 'cannot-print',
}
;[1200, 1203, 1401, 1403, 1485, 1682, 1684, 1686, 1687, 1688, 1700, 1701, 1890]
  .forEach(code => errorCodeMapping[code] = 'mechanical')
;[5011, 5012, 5100, 5200, 5400, '5B00', '5B01', 6000, 6800, 6801, 6930, 6931, 6932, 6933, 6936, 6937, 6938, 6940, 6941, 6942, 6943, 6944, 6945, 6946, 'B200', 'B201']
  .forEach(code => errorCodeMapping[code] = 'printer-error')

module.exports = async name => {
  const printer = ipp.Printer(`ipp://localhost:631/printers/${encodeURIComponent(name)}`)

  const msg = {
    'operation-attributes-tag': {
      // 'limit': 10,
      'which-jobs': 'all',
      'requested-attributes': [ 'job-state' ],
    },
  }

  const jobs = await promisify(printer.execute).call(printer, 'Get-Jobs', msg)
  const attributes = await promisify(printer.execute).call(printer, 'Get-Printer-Attributes', null)

  const hasJobPending = jobs['job-attributes-tag'].some(job => ['completed', 'canceled', 'processing-stopped', 'aborted'].indexOf(job['job-state']) < 0)

  const message = attributes['printer-attributes-tag']['printer-state-message'] || ''
  const errorCode = (message.match(/[\d|B]{4}/) || [ null ])[0]

  let state = 'idle'
  if (hasJobPending) state = 'printing'
  if (errorCode) state = errorCodeMapping[errorCode]
  
  return { state, message }
}
