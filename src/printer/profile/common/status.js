const printer = require('node-native-printer')

module.exports = name => {
  const info = printer.printerInfo(name)
  if (info.jobs.some(job => job.status !== 'completed' && job.status !== 'canceled')) {
    return 'printing'
  } else return 'idle'
}
