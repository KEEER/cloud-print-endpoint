const ipp = require('ipp')
const { promisify } = require('util')
require('ipp/lib/parser').handleUnknownTag = () => {}

module.exports = async name => {
  const printer = ipp.Printer(`ipp://localhost:631/printers/${encodeURIComponent(name)}`)

  const msg = {
    'operation-attributes-tag': {
      'which-jobs': 'all',
      'requested-attributes': [ 'job-state' ],
    },
  }
  const jobs = await promisify(printer.execute).call(printer, 'Get-Jobs', msg)
  const hasJobPending = jobs['job-attributes-tag'].some(job => ['completed', 'canceled'].indexOf(job['job-state']) < 0)

  let state = 'idle'
  if (hasJobPending) state = 'printing'
  
  return { state, message: null }
}
