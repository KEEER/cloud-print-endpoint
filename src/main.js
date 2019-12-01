/** @module main */

import { listen } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import log from './log'
import { isValidCode, db, spawnScript, pathFromName } from './util'
import { COLORED_PRINTER_NAME } from './consts'

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

ipcMain.on('print', async (e, code) => {
  // TODO: replace magic strings
  log(`[DEBUG] receiving print req ${code}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return
  if (Math.random() < 0.5) return e.reply('show-once', './img/error.svg', '未知错误', '请按回车键以继续')
  // TODO: pay
  try {
    // TODO: load options
    await spawnScript('printer/print', [ COLORED_PRINTER_NAME, '{"page-ranges":"1"}', pathFromName(fileEntry.id) ])
  } catch (err) {
    // TODO: handle errors
    return e.reply('show-once', './img/error.svg', '出现错误', err && ( err.message || err.toString() ))
  }
  e.reply('show-info', './img/print.svg', '正在打印中，请稍候', `共 ${fileEntry.pageCount} 页`)
  setTimeout(function () {
    e.reply('show-once', './img/done.svg', '打印完成！', '请按回车键以继续')
  }, 5000)
  // TODO: remove print job
}).on('print-preview', async (e, code) => {
  log(`[DEBUG] receiving print preview ${code}`)
  if (!isValidCode(code)) return
  const fileEntry = await db.findOne({ code })
  if (!fileEntry) return e.reply('show-filename', '取件码不存在', '请检查后重新输入。')
  return e.reply('show-filename', fileEntry.file, '请按回车键以继续')
})
