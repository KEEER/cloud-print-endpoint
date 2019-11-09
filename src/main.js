import { listen } from './server'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import log from './log'

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
  if (Math.random() < 0.25) return e.reply('print-reply', false)
  if (Math.random() < 1 / 3) return e.reply('print-reply', 'Error')
  setTimeout(function () {
    e.reply('print-done')
  }, 5000)
  return e.reply('print-reply', true)
})
