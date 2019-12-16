/** @module main */

import { listen } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import { REMOTE_BASE, PRINTER_ID, REMOTE_TIMEOUT, IS_DEVELOPMENT, LOGFILE, STRINGS } from './consts'
import { sign } from './job-token'
import log from './log'
import { PrintConfiguration } from './print-configuration'
import printJob from './printer/print-job'
import { printerStatus } from './status'
import { isValidCode, db } from './util'

let win

function createWindow() {
  win = new BrowserWindow({
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  })

  win.loadFile(path.resolve(__dirname, 'index.html'))

  if (!IS_DEVELOPMENT) {
    win.setFullScreen(true)
  } else {
    win.webContents.openDevTools()
    win.maximize()
  }

  let port = parseInt(process.env.PORT)
  if(!port || port <= 0 || port >= 65536 || Number.isNaN(port)) {
    port = 8080
    log('Port not specified, using 8080.')
  }
  listen(port, process.env.HOSTNAME)
}

app.on('ready', createWindow)

const handlePrintJob = async (e, code, dontPay) => {
  log(`[DEBUG] receiving print req ${code}${dontPay ? ', not paying' : ''}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return 'fileNotFound'

  if (!dontPay) {
    e.reply('show-info', './img/print.svg', STRINGS.paying, STRINGS.payingWait)
    const configObj = new PrintConfiguration(fileEntry.config).toJSON()
    configObj['page-count'] = fileEntry.pageCount * configObj.copies
    const configStr = JSON.stringify(configObj)
    try {
      const resPromise = fetch(new URL('/_api/print', REMOTE_BASE), {
        method: 'post',
        body: new URLSearchParams({
          code,
          config: configStr,
          id: PRINTER_ID,
          sign: sign(code, configStr, PRINTER_ID)
        }),
      }).then(res => res.json())
      // TODO: move the following lines into a util func
      const res = await new Promise((resolve, reject) => {
        resPromise.then(resolve).catch(reject)
        setTimeout(reject, REMOTE_TIMEOUT, 'Remote connection timeout.')
      })
      switch (res.status) {
        case 0:
          break
        
        case 1: // in debt
          e.reply('show-once', './img/error.svg', STRINGS.debtToPay, STRINGS.debtRecharge)
          return
        
        default:
          log(`[ERROR] unknown pay status ${JSON.stringify(res)}`)
          break
      }
    } catch (err) {
      log(`[ERROR] pay ${err && err.stack || err}`)
      return e.reply('show-once', './img/error.svg', STRINGS.cannotConnect, err && err.toString())
    }
  }
  
  try {
    const gen = printJob(fileEntry)
    let res = {}
    const showPrintingMessage = () => {
      const showMulticopies = fileEntry.config.copies > 1 && Array.isArray(res.value)
      const message = ( showMulticopies ? STRINGS.printingHintMulticopies : STRINGS.printingHint )
        .replace(/:pageCount:/g, fileEntry.pageCount)
        .replace(/:copies:/g, fileEntry.config.copies)
      e.reply('show-info', './img/print.svg', STRINGS.printing, message)
    }
    while ((res = await gen.next()) && !res.done) switch (Array.isArray(res.value) ? res.value[0] : res.value) {
      case 'start':
        showPrintingMessage()
        break
      case 'second-side':
        e.reply('show-once', './img/done.svg', STRINGS.firstSideOk, STRINGS.firstSidePrintSecond)
        await new Promise(resolve => ipcMain.once('hide-info', resolve))
        showPrintingMessage()
        break
      case 'done':
        let message
        if (fileEntry.config.copies > 1 && Array.isArray(res.value)) {
          if (res.value[1] !== fileEntry.config.copies - 1) {
            message = STRINGS.printingOkHintMulticopies
              .replace(/:copies:/g, fileEntry.config.copies)
              .replace(/:currentCopies:/g, res.value[1] + 1)
          } else message = STRINGS.printingOkHintAllDone
        } else message = STRINGS.printingOkHint
        e.reply('show-once', './img/done.svg', STRINGS.printingOk, message)
        await new Promise(resolve => ipcMain.once('hide-info', resolve))
        if (Array.isArray(res.value) && res.value[1] !== fileEntry.config.copies - 1) {
          showPrintingMessage()
        }
        break
      default:
        e.reply('show-info', './img/print.svg', STRINGS.printingInfo, res.value)
        break
    }
  } catch (err) {
    // TODO: handle errors
    log(`[ERROR] print ${err}`)
    return e.reply('show-info', './img/error.svg', STRINGS.printingError, err && ( err.message || err.toString() ))
  }
  // TODO: remove print job
}

ipcMain.once('ready', e => {
  for (let type of [ 'bw', 'colored' ]) {
    printerStatus[type].on('error', s => {
      e.reply('show-info', './img/error.svg', STRINGS.printingError, s.message || s.state)
    })
  }
}).on('print', (e, code) => handlePrintJob(e, code))
  .on('print-preview', async (e, code) => {
  log(`[DEBUG] receiving print preview ${code}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return e.reply('show-filename', STRINGS.noSuchCode, STRINGS.noSuchCodeCheck)
  return e.reply('show-filename', fileEntry.file, STRINGS.pressEnter)
}).on('admin', async (e, msg) => {
  const args = msg.split('-')
  switch (args[0]) {
    case '1':
    case 'exit':
      e.reply('exit-admin')
      break

    case '2':
      printerStatus.halted = true
      e.reply('show-info', './img/error.svg', STRINGS.serviceHalt, '')
      e.reply('exit-admin')
      break

    case '3':
      printerStatus.halted = false
      e.reply('hide-info')
      e.reply('exit-admin')
      break

    case '4':
      e.reply('admin', (await fs.readFile(LOGFILE)).toString().split('\n').slice(-40, -1).join('\n'))
      break

    case '5':
    case 'print':
      if (!isValidCode(args[1])) {
        e.reply('admin', '无效打印码')
        break
      }
      e.reply('exit-admin')
      if (await handlePrintJob(e, args[1], true) === 'fileNotFound') {
        e.reply('enter-admin', '未知打印码')
      }
      break

    case '6':
      e.reply('hide-info')
      e.reply('exit-admin')
      break
    
    case '0':
    case 'help':
    default:
      e.reply('admin', '1. 退出\n2. 暂停\n3. 恢复\n4. 日志\n5. 重打印-<打印码>\n6. 隐藏消息\n0. 帮助')
      break
  }
})
