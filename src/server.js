import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaBody from 'koa-body'
import session from 'koa-session'
import logger from 'koa-logger'
import uuid from 'uuid/v4'
import log from './log'
import path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { spawn } from 'child_process'

const app = new Koa()

app.keys = [ process.env.SESSION_KEY ]
app.use(logger(log))
   .use(koaBody({ multipart: true }))
   .use(session({ key: process.env.SESSION_NAME || 'sess' }, app))

const router = new KoaRouter()
app.use(router.routes())
   .use(router.allowedMethods())

router.get('/api/status', async ctx => {
  ctx.status = 200
  ctx.body = JSON.stringify({
    running: true,
    // TODO: printer status
  })
})

router.get('/', ctx => {
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

const pathFromName = name => path.join(process.env.FILEDIR || '', name)

router.post('/api/upload', async ctx => {
  let files = ctx.request.files.files, token = ctx.request.body.token
  // TODO: validate token
  if (!Array.isArray(ctx.session.tokens)) ctx.session.tokens = []
  if (!ctx.session.tokens.map(t => t.sign).includes(token.sign)) ctx.session.tokens.push(token)
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

export function listen (port, host = '0.0.0.0') {
  app.listen(port, host)
  log(`[INFO] Listening on http://${host}:${port}/`)
}
