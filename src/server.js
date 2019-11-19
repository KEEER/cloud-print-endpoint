import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaBody from 'koa-body'
import logger from 'koa-logger'
import uuid from 'uuid/v4'
import log from './log'
import path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { spawn } from 'child_process'
import { pathFromName, JobToken } from './util'

/** @see https://webgit.keeer.net/cloud-print/Documents/ */

const app = new Koa()

app.use(logger(log))
   .use(koaBody({ multipart: true }))

const router = new KoaRouter()
app.use(router.routes())
   .use(router.allowedMethods())

router.get('/', ctx => {
  // TODO
  ctx.body = `
  <!doctype html>
  <html>
    <body>
      <form action="/api/upload" enctype="multipart/form-data" method="post">
      <textarea name="token"></textarea>
      <input type="file" name="files" multiple="multiple">
      <button type="submit">Upload</button>
    </body>
  </html>`
})

router.put('/job', async ctx => {
  let files = ctx.request.files.files
  // TODO: validate token
  const token = new JobToken(ctx.request.body.token)
  try {
    await token.validate()
    await token.writeNonce()
  } catch (e) {
    ctx.body = {
      status: 1,
      error: 'Invalid token',
      response: null,
    }
  }
  files = Array.isArray(files) ? files : [ files ]
  if(!files.every(file => file && file.type === 'application/pdf')) {
    ctx.body = {
      status: 1,
      error: 'Not a PDF file',
      response: null,
    }
    return
  }
  const names = []
  let error = null
  for (let file of files) {
    const name = uuid() + '.pdf'
    const stream = createWriteStream(pathFromName(name))
    log(`[DEBUG] Uploading ${file.name} to ${name}`)
    try {
      await new Promise((resolve, reject) => {
        createReadStream(file.path).pipe(stream).on('close', resolve).on('error', reject)
      })
    } catch (e) {
      log(`[ERROR] Uploading file ${e.stack}`)
      error = e
      break
    }
    names.push({ file: file.name, name })
  }
  if(!error) for (let name of names) {
    try {
      name.pageCount = await new Promise((resolve, reject) => {
        setTimeout(reject, 2000)
        const spawnArgs = [ 'node', [ path.resolve(__dirname, 'pdf'), pathFromName(name.name) ] ]
        // log(`[DEBUG] starting parser with args ${spawnArgs[0]} ${spawnArgs[1].join(' ')}`)
        const parser = spawn(...spawnArgs)
        parser.on('error', reject)
        parser.stdout.on('data', data => {
          try {
            data = JSON.parse(data)
            if(data.status !== 0) throw data
            return resolve(data.result)
          } catch (e) {
            reject(e)
          }
        })
      })
    } catch (e) {
      log(`[ERROR] pdf parsing ${e.stack || JSON.stringify(e)}`)
      error = e
      break
    }
  }
  if (error) {
    ctx.body = {
      status: 1,
      error,
      response: null,
    }
    return
  }
  ctx.body = {
    status: 0,
    response: names,
  }
})

router.post('/get-config', ctx => {
  // TODO
})

router.post('/set-config', ctx => {
  // TODO
})

router.post('/delete-job', ctx => {
  // TODO
})

router.get('/status', async ctx => {
  ctx.status = 200
  ctx.body = JSON.stringify({
    running: true,
    // TODO: printer status
  })
})

export function listen (port, host = '0.0.0.0') {
  app.listen(port, host)
  log(`[INFO] Listening on http://${host}:${port}/`)
}
