const ipp = require('ipp')
const { promisify } = require('util')
require('ipp/lib/parser').handleUnknownTag = () => {}

const errorCodeMapping = {
  'media-empty-error': 'out-of-paper',
  'media-jam-error': 'paper-jam',
}

module.exports = async name => {
  const printer = ipp.Printer(`ipp://localhost:631/printers/${encodeURIComponent(name)}`)

  const msg = {
    'operation-attributes-tag': {
      'which-jobs': 'all',
      'requested-attributes': [ 'job-state' ],
    },
  }
  const jobs = await promisify(printer.execute).call(printer, 'Get-Jobs', msg)
  const hasJobPending = jobs['job-attributes-tag'].some(job => ['completed', 'canceled', 'processing-stopped', 'aborted'].indexOf(job['job-state']) < 0)
  const attributes = await promisify(printer.execute).call(printer, 'Get-Printer-Attributes', null)
  const reason = attributes['printer-attributes-tag']['printer-state-reasons']
  const printerMessage = attributes['printer-attributes-tag']['printer-state-message']

  let state = 'idle', message = null
  if (hasJobPending) state = 'printing'
  if (reason !== 'none') {
    message = printerMessage
    state = errorCodeMapping[reason] || 'unknown'
  }
  
  return { state, message }
}
