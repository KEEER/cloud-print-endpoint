const printer = require('node-native-printer')

module.exports = name => {
  const info = printer.printerInfo(name)
  if (info.jobs.some(job => job.status !== 'completed' && job.status !== 'canceled')) {
    return { state: 'printing', message: null }
  } else return { state: 'idle', message: null }
}
