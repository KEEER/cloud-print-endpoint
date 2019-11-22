import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaBody from 'koa-body'
import logger from 'koa-logger'
import uuid from 'uuid/v4'
import log from './log'
import path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { spawn } from 'child_process'
import { pathFromName, db } from './util'
import JobToken from './job-token'

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
      <form action="/job" enctype="multipart/form-data" method="post">
      <textarea name="token"></textarea>
      <input type="file" name="file">
      <button type="submit">Upload</button>
    </body>
  </html>`
})

router.post('/job', async ctx => {
  let file = ctx.request.files.file
  const token = new JobToken(JSON.parse(ctx.request.body.token))
  const { code } = token
  try {
    await token.validate()
    await token.writeNonce()
  } catch (e) {
    log(`[WARN] bad token: ${e}`)
    return ctx.body = {
      status: 1,
      error: 'Invalid token',
      response: null,
    }
  }
  if ((await db.find({ code })).length !== 0) {
    return ctx.body = {
      status: 1,
      error: 'Code already using',
      response: null,
    }
  }
  if (Array.isArray(file)) {
    return ctx.body = {
      status: 1,
      error: 'Only one file per code'
    }
  }
  if(file.type !== 'application/pdf') {
    return ctx.body = {
      status: 1,
      error: 'Not a PDF file',
      response: null,
    }
  }
  let error = null
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
  }
  const info = { file: file.name, name, time: Date.now(), code }
  if(!error) {
    try {
      info.pageCount = await new Promise((resolve, reject) => {
        setTimeout(reject, 2000)
        const spawnArgs = [ 'node', [ path.resolve(__dirname, 'pdf'), pathFromName(info.name) ] ]
        log(`[DEBUG] starting parser with args ${spawnArgs[0]} ${spawnArgs[1].join(' ')}`)
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
      log(`[WARN] pdf parsing ${e.stack || JSON.stringify(e)}`)
      error = e
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
  db.insert(info)
  ctx.body = {
    status: 0,
    response: info,
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
