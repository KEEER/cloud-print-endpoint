const file = process.argv[2]
if(!file) {
  console.log('{"status":1,"message":"No file given"}')
  process.exit(1)
}
try {
  console.log(JSON.stringify({
    status: 0,
    result: require('hummus').createReader(file).getPagesCount(),
  }))
} catch (e) {
  console.log(JSON.stringify({
    status: 1,
    error: e.toString(),
  }))
  process.exit(1)
}
