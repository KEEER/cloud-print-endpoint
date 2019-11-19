const { generateKeyPairSync } = require('crypto')
const { writeFileSync } = require('fs')

if (process.argv.length !== 4) console.log('Usage: node scripts/generate-keys [pubfile] [privfile]'), process.exit(1)

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'pkcs1',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem',
  },
})

writeFileSync(process.argv[2], publicKey)
writeFileSync(process.argv[3], privateKey)
