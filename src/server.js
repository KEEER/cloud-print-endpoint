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
import fetch from 'node-fetch'
import uuid from 'uuid/v4'
import { HALTED_MESSAGE, REMOTE_BASE, REMOTE_TIMEOUT, JOB_TOKEN_TIMEOUT, DEFAULT_HEADERS, CONTROL_CODE_TIMEOUT } from './consts'
import { sign, verify } from './job-token'
import log from './log'
import { PrintConfiguration } from './print-configuration'
import { printerStatus, printerMessage } from './status'
import { pathFromName, db, getJobToken, spawnScript, useTimeout, normalizeError } from './util'
import { randomBytes } from 'crypto'
import { EventEmitter } from 'events'

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

app.use((ctx, next) => {
  ctx.response.append('X-Powered-By', 'KEEER Cloud Print')
  // CORS
  ctx.response.append('Access-Control-Allow-Origin', '*')
  ctx.response.append('Access-Control-Allow-Headers', 'Content-Type')
  ctx.response.append('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return next()
})

const router = new KoaRouter()
app.use(router.routes())
  .use(router.allowedMethods())

router.get('/', ctx => {
  // TODO
  ctx.body = `
  <!doctype html>
  <html>
    <body>
      <h1>Manual file uploading</h1>
      <form action="/job" enctype="multipart/form-data" method="post">
      <textarea name="token"></textarea>
      <input type="file" name="file">
      <button type="submit">Upload</button>
    </body>
  </html>`
})

const createControlCode = () => randomBytes(8).toString('hex')
const controlCodes = Array(4).fill(0).map(createControlCode)
export const getControlCode = () => controlCodes[controlCodes.length - 1]
export const controlCodeEvents = new EventEmitter()
setInterval(() => {
  const code = createControlCode()
  controlCodes.push(code)
  controlCodes.shift()
  controlCodeEvents.emit('update', code)
}, CONTROL_CODE_TIMEOUT)

export const inputEvents = new EventEmitter()
router.post('/control/:code', async ctx => {
  if (!controlCodes.includes(ctx.params.code)) return ctx.status = 401
  ctx.status = 200
  const code = ctx.request.body
  if (code === '←') return inputEvents.emit('input', 'BKSP')
  if (code === '✓') return inputEvents.emit('input', 'ENTER')
  if (code.length !== 1) return ctx.status = 400
  if (code > '9' || code < '0') return ctx.status = 400
  return inputEvents.emit('input', Number(code))
})
router.get('/control/:code', async ctx => {
  if (!controlCodes.includes(ctx.params.code)) return ctx.status = 401
  return ctx.body = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>无接触输入 | Cloud Print</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    img { border: none; }
    table { border-collapse: collapse; }
    a { text-decoration: none; }
    a:hover, a:active, a:focus { text-decoration: underline; }

    body {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #fcfffc;
      color: #222;
      border-top: 4px solid #f57c00;
    }
    .cell {
      display: inline-block;
      width: 25vw;
      height: 25vw;
      margin: 1vw;
      font-size: 8vw;
      border-radius: 50%;
      border: 1px solid #d3d5d3;
      transition: background-color .2s ease;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      user-select: none;
    }
    .cell:hover, .cell:active {
      background: #d3d5d3;
    }
    #tip { position: fixed; bottom: 16px; left: 16px; }
    </style>
  </head>
  <body>
    <main>
      <noscript>
        无接触输入需要您的浏览器启用 JavaScript。
      </noscript>
      <div id="panel">
        <div class="col">
          <div class="cell">1</div>
          <div class="cell">2</div>
          <div class="cell">3</div>
        </div>
        <div class="col">
          <div class="cell">4</div>
          <div class="cell">5</div>
          <div class="cell">6</div>
        </div>
        <div class="col">
          <div class="cell">7</div>
          <div class="cell">8</div>
          <div class="cell">9</div>
        </div>
        <div class="col">
          <div class="cell">←</div>
          <div class="cell">0</div>
          <div class="cell">✓</div>
        </div>
      </div>
      <div id="tip">新用户？<a href="https://print.keeer.net/welcome">点击这里</a></div>
    </main>
    <script>
    var panel = document.getElementById('panel')
    var cells = panel.querySelectorAll('.cell')
    for (var i = 0; i < cells.length; i++) listen(cells[i])
    function listen (el) {
      el.addEventListener('click', function () {
        fetch(location.href, { method: 'post', body: el.innerText })
          .then(function (res) { if (res.status === 401) alert('会话超时,请重新扫描二维码') })
          .catch(function () { alert('发生错误，请重试') })
      })
    }
    </script>
  </body>
  </html>
  `
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
  log(`[DEBUG] Uploading ${file.name} on ${code} to ${id}`)
  try {
    await new Promise((resolve, reject) => {
      createReadStream(file.path).pipe(stream).on('close', resolve).on('error', reject)
    })
  } catch (e) {
    log(`[ERROR] Uploading file ${normalizeError(e)}`)
    return ctx.sendError(e)
  }
  const info = { file: file.name, id, time: Date.now(), code, config: new PrintConfiguration() }
  try {
    info.pageCount = await spawnScript('pdf', [pathFromName(info.id)], 15 * 1000)
  } catch (e) {
    log(`[WARN] pdf parsing ${normalizeError(e)}`)
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

router.post('/get-configs', async ctx => {
  const { codes, timestamp, sign } = ctx.request.body
  if (!Array.isArray(codes) || !timestamp || !sign) return ctx.sendError('Invalid form.')
  if (timestamp + JOB_TOKEN_TIMEOUT < Date.now() / 1000 || !verify(sign, codes.join(','), timestamp)) {
    return ctx.sendError('Invalid signature.')
  }
  const fileEntries = await Promise.all(codes.map(code => db.findOne({ code })))
  for (let fileEntry of fileEntries) {
    if (!fileEntry) continue
    fileEntry.config = new PrintConfiguration(fileEntry.config)
    fileEntry['page-count'] = fileEntry.pageCount
    delete fileEntry.pageCount
    delete fileEntry._id
  }
  return ctx.body = { status: 0, response: fileEntries.filter(file => !!file) }
})

router.post('/set-config', getJobToken, async ctx => {
  const config = new PrintConfiguration(ctx.request.body.config)
  const code = ctx.state.token.code
  try {
    await db.update({ code }, { $set: { config } })
  } catch (e) {
    log(`[WARN] set config ${normalizeError(e)}`)
    return ctx.sendError(e)
  }
  return ctx.body = { status: 0 }
})

router.post('/delete-job', getJobToken, async ctx => {
  const code = ctx.state.token.code
  const url = new URL('/_api/delete-job-token', REMOTE_BASE)
  url.search = new URLSearchParams({
    code,
    sign: sign(code),
  })
  try {
    const res = await useTimeout(fetch(url, { headers: DEFAULT_HEADERS }).then(res => res.json()), REMOTE_TIMEOUT)
    if (res.status !== 0) throw res
    log(`[DEBUG] about to remove job ${code}`)
    await db.remove({ code })
  } catch (e) {
    log(`[WARN] delete job ${normalizeError(e)}`)
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
    message: printerStatus.halted ? HALTED_MESSAGE : printerMessage,
  },
})

export function listen(port, host = '0.0.0.0') {
  app.listen(port, host)
  log(`[INFO] Listening on http://${host}:${port}/`)
}
