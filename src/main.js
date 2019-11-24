/** @module main */

import { listen } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import log from './log'
import { isValidCode } from './util'

let win

function createWindow() {
  win = new BrowserWindow({
    // TODO
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  })

  win.loadFile(path.resolve(__dirname, 'index.html'))
  // win.setFullScreen(true)
  win.webContents.openDevTools()
  win.maximize()

  let port = parseInt(process.env.PORT)
  if(!port || port <= 0 || port >= 65536 || Number.isNaN(port)) {
    port = 8080
    log('Port not specified, using 8080.')
  }
  listen(port, process.env.HOSTNAME)
}

app.on('ready', createWindow)

ipcMain.on('print', (e, code) => {
  log(`[DEBUG] receiving print req ${code}`)
  if (!isValidCode(code)) return
  if (code < 1000) return
  if (Math.random() < 0.5) return e.reply('show-once', './img/error.svg', '未知错误', '请按回车键以继续')
  setTimeout(function () {
    e.reply('show-once', './img/done.svg', '打印完成！', '请按回车键以继续')
  }, 5000)
  return e.reply('show-info', './img/print.svg', '正在打印中，请稍候', '页面 1 / 1')
}).on('print-preview', (e, code) => {
  log(`[DEBUG] receiving print preview ${code}`)
  if (!isValidCode(code)) return
  if (code < 1000) return e.reply('show-filename', 'No file found', 'Please check your number.')
  return e.reply('show-filename', `File ${code}.pdf`, '请按回车键以继续')
})
