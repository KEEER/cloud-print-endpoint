/** @module main */

import { listen } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import { REMOTE_BASE, PRINTER_ID, REMOTE_TIMEOUT, IS_DEVELOPMENT, LOGFILE } from './consts'
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
  // TODO: replace magic strings
  log(`[DEBUG] receiving print req ${code}${dontPay ? ', not paying' : ''}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return 'fileNotFound'

  if (!dontPay) {
    e.reply('show-info', './img/print.svg', '正在支付', '请稍等……')
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
          e.reply('show-once', './img/error.svg', '您有未结清帐务', '请充值后再打印。')
          return
        
        default:
          log(`[ERROR] unknown pay status ${JSON.stringify(res)}`)
          break
      }
    } catch (err) {
      log(`[ERROR] pay ${err && err.stack || err}`)
      return e.reply('show-once', './img/error.svg', '无法连接至服务器', err && err.toString())
    }
  }
  
  try {
    const gen = printJob(fileEntry)
    let res = {}
    while ((res = await gen.next()) && !res.done) switch (Array.isArray(res.value) ? res.value[0] : res.value) {
      case 'start':
        e.reply('show-info', './img/print.svg', '正在打印中，请稍候', `共 ${fileEntry.pageCount} 页${fileEntry.config.copies > 1 && Array.isArray(res.value) ? `，正在打印 1/${fileEntry.config.copies} 份` : ''}`)
        break
      case 'second-side':
        e.reply('show-once', './img/done.svg', '正面打印完成！', '请插入纸张，按回车键以继续打印反面')
        await new Promise(resolve => ipcMain.once('hide-info', resolve))
        e.reply('show-info', './img/print.svg', '正在打印中，请稍候', `共 ${fileEntry.pageCount} 页`)
        break
      case 'done':
        e.reply('show-once', './img/done.svg', '打印完成！', `请按回车键以继续${fileEntry.config.copies > 1 ? Array.isArray(res.value) ? res.value[1] !== fileEntry.config.copies - 1 ? `，已经打印 ${res.value[1] + 1}/${fileEntry.config.copies} 份` : '，全部完成' : '' : ''}`)
        await new Promise(resolve => ipcMain.once('hide-info', resolve))
        if (Array.isArray(res.value) && res.value[1] !== fileEntry.config.copies - 1) e.reply('show-info', './img/print.svg', '正在打印中，请稍候', `共 ${fileEntry.pageCount} 页${fileEntry.config.copies > 1 && Array.isArray(res.value) ? `，正在打印 ${res.value[1] + 2}/${fileEntry.config.copies} 份` : ''}`)
        break
      default:
        e.reply('show-info', './img/print.svg', '打印信息', res.value)
        break
    }
  } catch (err) {
    // TODO: handle errors
    log(`[ERROR] print ${err}`)
    return e.reply('show-info', './img/error.svg', '出现错误', err && ( err.message || err.toString() ))
  }
  // TODO: remove print job
}

ipcMain.once('ready', e => {
  for (let type of [ 'bw', 'colored' ]) {
    printerStatus[type].on('error', s => {
      e.reply('show-info', './img/error.svg', '出现错误', s.message || s.state)
    })
  }
}).on('print', (e, code) => handlePrintJob(e, code))
  .on('print-preview', async (e, code) => {
  log(`[DEBUG] receiving print preview ${code}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return e.reply('show-filename', '取件码不存在', '请检查后重新输入。')
  return e.reply('show-filename', fileEntry.file, '请按回车键以继续')
}).on('admin', async (e, msg) => {
  const args = msg.split('-')
  switch (args[0]) {
    case '1':
    case 'exit':
      e.reply('exit-admin')
      break

    case '2':
      printerStatus.halted = true
      e.reply('show-info', './img/error.svg', '暂停服务', '')
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
