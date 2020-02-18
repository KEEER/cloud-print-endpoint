const file = process.argv[2]
if(!file) {
  console.log('{"status":1,"message":"No file given"}')
  process.exit(1)
}
;(async () => {
  try {
    const pdfParser = new (require('pdf2json'))()
    pdfParser.loadPDF(file)
    const res = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', resolve)
      setTimeout(reject, 2000, 'timeout')
    })
    console.log(JSON.stringify({
      status: 0,
      response: res.formImage.Pages.length,
    }))
  } catch (e) {
    console.log(JSON.stringify({
      status: 1,
      error: e.toString(),
    }))
    process.exit(1)
  }
})()
