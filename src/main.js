/** @module main */

import { listen, inputEvents, controlCodeEvents, getControlCode } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import { REMOTE_BASE, PRINTER_ID, REMOTE_TIMEOUT, IS_DEVELOPMENT, LOGFILE, STRINGS, DEFAULT_HEADERS } from './consts'
import { sign } from './job-token'
import log from './log'
import { PrintConfiguration } from './print-configuration'
import printJob from './printer/print-job'
import { printerStatus } from './status'
import { isValidCode, db, useTimeout, normalizeError, ipAddress, networkEvents } from './util'

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
    if (fileEntry.printed) return 'fileNotFound'
    if (!ipAddress) return e.reply('show-once', './img/error.svg', STRINGS.cannotPayOffline, STRINGS.cannotPayOfflineHint)
    e.reply('show-info', './img/print.svg', STRINGS.paying, STRINGS.payingWait)
    const configObj = new PrintConfiguration(fileEntry.config).toJSON()
    configObj['page-count'] = fileEntry.pageCount * configObj.copies
    const configStr = JSON.stringify(configObj)
    try {
      const res = await useTimeout(fetch(new URL('/_api/print', REMOTE_BASE), {
        method: 'post',
        body: new URLSearchParams({
          code,
          config: configStr,
          id: PRINTER_ID,
          sign: sign(code, configStr, PRINTER_ID)
        }),
        headers: DEFAULT_HEADERS,
      }).then(res => res.json()), REMOTE_TIMEOUT, 'Remote connection timeout.')
      switch (res.status) {
        case 0:
          break
        
        case 1: // in debt
          e.reply('show-once', './img/error.svg', STRINGS.debtToPay, STRINGS.debtRecharge)
          return

        case 2: // using debt
          e.reply('show-once', './img/error.svg', STRINGS.usingDebt, STRINGS.usingDebtContinue)
          await new Promise(resolve => ipcMain.once('hide-info', resolve))
          break

        case 3: // code not exist
          log(`[ERROR] pay code not exist ${normalizeError(res)}`)
          e.reply('show-once', './img/error.svg', STRINGS.noSuchCode, STRINGS.noSuchCodeCheck)
          return

        default:
          log(`[ERROR] unknown pay status ${normalizeError(res)}`)
          break
      }
    } catch (err) {
      log(`[ERROR] pay ${normalizeError(err)}`)
      return e.reply('show-once', './img/error.svg', STRINGS.cannotConnect, err && err.toString())
    }
  }
  
  try {
    const showPrintingMessage = res => {
      const showMulticopies = fileEntry.config.copies > 1 && Array.isArray(res)
      const message = ( showMulticopies ? STRINGS.printingHintMulticopies : STRINGS.printingHint )
        .replace(/:pageCount:/g, fileEntry.pageCount)
        .replace(/:copies:/g, fileEntry.config.copies)
        .replace(/:currentCopies:/g, res[1] + 1 || 1)
      e.reply('show-info', './img/print.svg', STRINGS.printing, message)
    }
    log(`[DEBUG] about to start printing job ${fileEntry.code}: '${fileEntry.file}' (${fileEntry.pageCount}) * ${fileEntry.config.copies}, ${fileEntry.config.colored ? 'colored' : 'bw'}${fileEntry.config['double-sided'] || fileEntry.config.doubleSided ? ', ds' : ''}`)
    for await (let res of printJob(fileEntry)) {
      switch (Array.isArray(res) ? res[0] : res) {
        case 'start':
          showPrintingMessage(res)
          break
        case 'second-side':
          e.reply('show-once', './img/done.svg', STRINGS.firstSideOk, STRINGS.firstSidePrintSecond)
          await new Promise(resolve => ipcMain.once('hide-info', resolve))
          showPrintingMessage(res)
          break
        case 'done':
          let message
          if (fileEntry.config.copies > 1 && Array.isArray(res)) {
            if (res[1] !== fileEntry.config.copies - 1) {
              message = STRINGS.printingOkHintMulticopies
                .replace(/:copies:/g, fileEntry.config.copies)
                .replace(/:currentCopies:/g, res[1] + 1)
            } else message = STRINGS.printingOkHintAllDone
          } else message = STRINGS.printingOkHint
          const notLastCopy = fileEntry.config.copies > 1 && Array.isArray(res) && res[1] !== fileEntry.config.copies - 1
          e.reply('show-once', './img/done.svg', STRINGS.printingOk, message, !notLastCopy)
          await new Promise(resolve => ipcMain.once('hide-info', resolve))
          if (notLastCopy) {
            res[1]++
            showPrintingMessage(res)
          }
          break
        default:
          e.reply('show-info', './img/print.svg', STRINGS.printingInfo, res)
          break
      }
    }
  } catch (err) {
    log(`[ERROR] print ${normalizeError(err)}`)
    return e.reply('show-info', './img/error.svg', STRINGS.printingError, err && ( err.message || err.toString() ))
  }
  await db.update({ code }, { $set: { printed: true } })
}

ipcMain.once('ready', e => {
  for (let type of [ 'bw', 'colored' ]) {
    printerStatus[type].on('error', s => {
      e.reply('show-info', './img/error.svg', STRINGS.printingError, s.message || s.state)
    })
  }
  const updateControlUrl = () => e.reply('control-url', `http://${ipAddress}/control/${getControlCode()}`)
  updateControlUrl()
  inputEvents.on('input', input => e.reply('handle-input', input))
  controlCodeEvents.on('update', updateControlUrl)
  networkEvents.on('update', updateControlUrl)
  networkEvents.on('disconnected', () => e.reply('network-error'))
  if (!ipAddress) e.reply('network-error')
  networkEvents.on('connected', () => e.reply('network-connected'))
}).on('print', (e, code) => handlePrintJob(e, code))
  .on('print-preview', async (e, code) => {
  log(`[DEBUG] receiving print preview ${code}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry || fileEntry.printed) return e.reply('show-filename', STRINGS.noSuchCode, STRINGS.noSuchCodeCheck)
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
      let logs = (await fs.readFile(LOGFILE)).toString().split('\n')
      if (args[1] !== '1') logs = logs.filter(log => log.indexOf('[HTTP]') < 0)
      const page = isFinite(args[2]) ? Number(args[2]) : 1
      e.reply('admin', logs.slice(-40 * page, 39 - 40 * page).join('\n'))
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

    case '7':
      e.reply('admin', (await db.find({})).map(job => {
        const config = new PrintConfiguration(job.config)
        return ` (${job.code}) ${job.file} (${job.pageCount}) x ${config.copies} @ colored: ${config.colored}, double-sided: ${config.doubleSided}${job.printed ? ', printed' : ''} uploaded @ ${new Date(job.time).toLocaleString()}`
      }).join('\n'))
      break

    case 'login':
      log('[INFO] logging into admin interface')
      // fallthrough
    case '0':
    case 'help':
    default:
      e.reply('admin', '1. 退出\n2. 暂停\n3. 恢复\n4. 精简日志\n4--n. 精简日志第 n 页\n4-1. 全日志\n4-1-n. 全日志第 n 页\n5. 重打印-<打印码>\n6. 隐藏消息\n7. 打印码情况\n0. 帮助')
      break
  }
})
