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
import log from './log'
import { pathFromName, db, getJobToken, spawnScript } from './util'
import { PrintConfiguration } from './print-configuration'
import { printerStatus, printerMessage } from './status'

const app = new Koa()

app.context.sendError = function (message) {
  if (typeof message === 'undefined') message = null
  if (message !== null && typeof message !== 'string') message = message.toString()
  this.body = {
    status: 1,
    message,
    response: null,
  }
  return
}

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

  // sanity check
  if ((await db.find({ code })).length !== 0) return ctx.sendError('Code already using')
  if (Array.isArray(file)) return ctx.sendError('Only one file per code')
  if (file.type !== 'application/pdf') return ctx.sendError('Not a PDF file')

  const id = uuid() + '.pdf'
  const stream = createWriteStream(pathFromName(id))
  log(`[DEBUG] Uploading ${file.name} to ${id}`)
  try {
    await new Promise((resolve, reject) => {
      createReadStream(file.path).pipe(stream).on('close', resolve).on('error', reject)
    })
  } catch (e) {
    log(`[ERROR] Uploading file ${e.stack}`)
    return ctx.sendError(e)
  }
  const info = { file: file.name, id, time: Date.now(), code, config: new PrintConfiguration() }
  try {
    info.pageCount = await spawnScript('pdf', [pathFromName(info.id)])
  } catch (e) {
    log(`[WARN] pdf parsing ${e && e.stack || JSON.stringify(e)}`)
    return ctx.sendError(e)
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

router.post('/set-config', getJobToken, async ctx => {
  const id = ctx.request.body.id
  const config = ctx.request.body.config
  try {
    await db.update({ id }, { $set: { config } })
  } catch (e) {
    log(`[WARN] set config ${e}`)
    return ctx.sendError(e)
  }
  return ctx.body = { status: 0 }
})

router.post('/delete-job', getJobToken, async ctx => {
  const id = ctx.request.body.id
  try {
    await db.remove({ id })
  } catch (e) {
    log(`[WARN] delete job ${e}`)
    return ctx.sendError(e)
  }
  return ctx.body = { status: 0 }
})

router.get('/status', ctx => ctx.body = {
  status: 0,
  response: {
    name: process.env.PRINTER_NAME,
    geolocation: process.env.PRINTER_GEOLOCATION || null,
    status: printerStatus,
    message: printerMessage,
  },
})

export function listen(port, host = '0.0.0.0') {
  app.listen(port, host)
  log(`[INFO] Listening on http://${host}:${port}/`)
}
