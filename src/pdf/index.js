const file = process.argv[2]
if(!file) {
  console.log('{"status":1,"message":"No file given"}')
  process.exit(1)
}
;(async () => {
  try {
    const pdfParser = require('pdfinfo')(file)
    const res = await new Promise((resolve, reject) => {
      pdfParser.info((err, meta) => {
        if (err) return reject(err)
        return resolve(meta)
      })
      setTimeout(reject, 15 * 1000, 'timeout')
    })
    console.log(JSON.stringify({
      status: 0,
      response: res.pages,
    }))
    process.exit(0)
  } catch (e) {
    console.log(JSON.stringify({
      status: 1,
      error: e.toString(),
      file,
    }))
    process.exit(1)
  }
})()
