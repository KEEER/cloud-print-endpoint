if (process.argv.length !== 4) {
  console.log('Usage: node scripts/create-job-token [code] [privfile]')
  process.exit(1)
}
process.env.REMOTE_KEYFILE = process.env.ENDPOINT_KEYFILE = process.argv[3]
const code = process.argv[2]

const { sign } = require('esm')(module)('../src/job-token')

const timestamp = parseInt(Date.now() / 1000)
const signature = sign(code, timestamp)
console.log(JSON.stringify({ code, timestamp, sign: signature }, null, 2))
process.exit(0)
