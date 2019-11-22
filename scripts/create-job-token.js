if (process.argv.length !== 4) {
  console.log('Usage: node scripts/create-job-token [code] [privfile]')
  process.exit(1)
}
process.env.REMOTE_KEYFILE = process.env.ENDPOINT_KEYFILE = process.argv[3]
const code = process.argv[2]

const { sign } = require('esm')(module)('../src/job-token')
const uuid = require('uuid/v4')

const nonce = uuid()
const signature = sign(code, nonce)
console.log(JSON.stringify({ code, nonce, sign: signature }, null, 2))
process.exit(0)
