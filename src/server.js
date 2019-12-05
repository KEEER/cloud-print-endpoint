/**
 * Server module.
 * @module server
 * @see https://webgit.keeer.net/cloud-print/Documents/
 */

import { createReadStream, createWriteStream } from 'fs'
import Koa from 'koa'
import koaBody from 'koa-body'
import logger from 'koa-logger'
import KoaRouter from 'koa-router'
import uuid from 'uuid/v4'
import { DEFAULT_CONFIG } from './consts'
import log from './log'
import { pathFromName, db, getJobToken, spawnScript } from './util'

let printerMessage = '待命'
let printerStatus = null

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

router.post('/job', getJobToken, async ctx => {
  let file = ctx.request.files.file
  const { code } = ctx.state.token
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
  const id = uuid() + '.pdf'
  const stream = createWriteStream(pathFromName(id))
  log(`[DEBUG] Uploading ${file.name} to ${id}`)
  try {
    await new Promise((resolve, reject) => {
      createReadStream(file.path).pipe(stream).on('close', resolve).on('error', reject)
    })
  } catch (e) {
    log(`[ERROR] Uploading file ${e.stack}`)
    error = e
  }
  const info = { file: file.name, id, time: Date.now(), code, config: { ...DEFAULT_CONFIG } }
  if(!error) {
    try {
      info.pageCount = await spawnScript('pdf', [ pathFromName(info.id) ])
    } catch (e) {
      log(`[WARN] pdf parsing ${e && e.stack || JSON.stringify(e)}`)
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
  await db.insert(info)
  info['page-count'] = info.pageCount
  delete info.pageCount
  delete info.time
  delete info.file
  ctx.body = {
    status: 0,
    response: info,
  }
})

router.post('/get-configs', ctx => {
  // TODO
})

router.post('/set-config', ctx => {
  const token = ctx.request.body.token;
  const id = ctx.request.body.id;
  const config = ctx.request.body.config;
  if(!token.validate()){
    ctx.body = {
      status: 1
    }
    return
  }
  let error;
  await db.update({info}, { $set: { config }}).catch(
    e => error = e
  )
  if(error){
    ctx.body = {
      status: 1,
      error
    }
    return
  }
  ctx.body = {
    status: 0
  }
})

router.post('/delete-job', ctx => {
  // TODO
})

router.get('/status', ctx => ctx.body = {
  status: 0,
  response: {
    name: process.env.PRINTER_NAME,
    geolocation: process.env.PRINTER_GEOLOCATION || null,
    status: printerStatus, // TODO
    message: printerMessage, // TODO
  },
})

export function listen (port, host = '0.0.0.0') {
  app.listen(port, host)
  log(`[INFO] Listening on http://${host}:${port}/`)
}
