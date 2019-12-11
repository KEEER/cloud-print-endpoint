/**
 * Module in renderer process to control FE.
 * Use IPC to control this module.
 * @module controls
 */

// native modules cannot be `import`ed
const { ipcRenderer } = require('electron')
import { CODE_DIGITS, ADMIN_PASSWORD } from './consts.js'

const $ = function (name) { return document.querySelector(name) }

const code = []
const codeEls = new Array(CODE_DIGITS).fill(null).map(( _v, i ) => $(`#num${i}`))
const codeAreaEl = $('#code-area')
const infoAreaEl = $('#info-area')
const filenameEl = $('#filename')
const tipEl = $('#tip')
const infoImageEl = $('#info-image')
const infoTitleEl = $('#info-title')
const infoSubtitleEl = $('#info-subtitle')
const adminPasswordEl = $('#admin-password')

function clearCode () {
  code.length = 0
  for (let i = 0; i < codeEls.length; i++) {
    codeEls[i].innerText = ''
  }
  hideFilename()
}

/**
 * Shows a message on the filename area.
 * @param {string} filename Filename to be shown
 * @param {string} tip Tip to be shown
 * @example win.webContents.send('show-filename', 'Print.pdf', 'Press enter to continue')
 * @example event.reply('show-filename', 'Print.pdf', 'Press enter to continue')
 */
function showFilename (filename, tip) {
  filenameEl.innerText = filename
  tipEl.innerText = tip
}

/**
 * Hides the message on the filename area.
 * @example win.webContents.send('hide-filename')
 * @example event.reply('hide-filename')
 */
function hideFilename () {
  filenameEl.innerText = ''
  tipEl.innerText = ''
}

/**
 * Shows an information card that cannot be cancelled by user input.
 * @param {string} imageSrc `src` attribute of image, relative to `/src`
 * @param {string} title title to be shown
 * @param {string} subtitle subtitle to be shown
 * @example win.webContents.send('show-info', './img/error.svg', 'Print Error', 'Out of paper')
 * @example event.reply('show-info', './img/error.svg', 'Print Error', 'Out of paper')
 */
function showInfo (imageSrc, title, subtitle) {
  infoImageEl.src = imageSrc
  infoTitleEl.innerText = title
  infoSubtitleEl.innerText = subtitle

  codeAreaEl.style.display = 'none'
  infoAreaEl.style.display = ''

  document.removeEventListener('keydown', handleCode)
}

/**
 * Shows an information card that can be cancelled by user hitting enter.
 * @param {string} imageSrc `src` attribute of image, relative to `/src`
 * @param {string} title title to be shown
 * @param {string} subtitle subtitle to be shown
 * @example win.webContents.send('show-once', './img/done.svg', 'Print Done', 'Click enter to continue')
 * @example event.reply('show-once', './img/done.svg', 'Print Done', 'Click enter to continue')
 */
function showOnce (imageSrc, title, subtitle) {
  showInfo(imageSrc, title, subtitle)
  document.addEventListener('keydown', handleError)
}

/**
 * Hides information card.
 * @example win.webContents.send('hide-info')
 * @example event.reply('hide-info')
 */
function hideInfo () {
  infoImageEl.src = ''
  infoTitleEl.innerText = ''
  infoSubtitleEl.innerText = ''

  clearCode()

  codeAreaEl.style.display = ''
  infoAreaEl.style.display = 'none'

  document.addEventListener('keydown', handleCode)
}

let adminStroke = 0
let adminStrokeTime = 0
let isInAdmin = false

function handleCode (e) {
  e.preventDefault()
  console.log('Pressed 0x' + e.keyCode.toString(16))
  if (e.keyCode === 0x74) location.reload() // F5
  if (e.keyCode >= 0x30 && e.keyCode <= 0x39 || e.keyCode >= 0x60 && e.keyCode <= 0x69) { // number
    if (code.length === CODE_DIGITS) return
    const number = e.keyCode - (e.keyCode > 0x50 ? 0x60 : 0x30)
    codeEls[code.length].innerText = number
    code.push(number)
    if (code.length === CODE_DIGITS) {
      ipcRenderer.send('print-preview', code.join(''))
    }
  }
  if (e.keyCode === 0x08 || e.keyCode === 0x2e) { // bksp
    if (code.length === 0) return
    codeEls[code.length - 1].innerText = ''
    code.pop()
    hideFilename()
  }
  if (e.keyCode === 0x0d && code.length === CODE_DIGITS) { // enter
    ipcRenderer.send('print', code.join(''))
  }
  if (e.keyCode === 0xbf || e.keyCode === 0x6f) { // slash
    if (adminStrokeTime < Date.now() - 4000) {
      adminStroke = 0
      adminStrokeTime = Date.now()
    }
    adminStroke++
    if (adminStroke === 4) {
      adminPasswordEl.style.display = 'block'
      adminPasswordEl.focus()
      document.removeEventListener('keydown', handleCode)
      setTimeout(() => {
        if (isInAdmin) return
        document.addEventListener('keydown', handleCode)
        adminPasswordEl.value = ''
        adminPasswordEl.style.display = 'none'
        adminPasswordEl.blur()
      }, 10 * 1000)
    }
  }
}

adminPasswordEl.addEventListener('keyup', e => {
  if (e.keyCode === 0x0d) { // enter
    if (adminPasswordEl.value === ADMIN_PASSWORD) {
      isInAdmin = true
      adminPasswordEl.value = ''
      adminPasswordEl.style.display = 'none'
      // TODO: admin interface
      alert('TODO')
    }
  }
})

function handleError (e) {
  e.preventDefault()
  if (e.keyCode === 0x0d) { // enter
    document.removeEventListener('keydown', handleError)
    hideInfo()
  }
}

document.addEventListener('keydown', handleCode)

ipcRenderer.on('show-info', (_e, ...args) => showInfo(...args))
  .on('show-once', (_e, ...args) => showOnce(...args))
  .on('hide-info', hideInfo)
  .on('show-filename', (_e, ...args) => showFilename(...args))
  .on('hide-filename', hideFilename)
