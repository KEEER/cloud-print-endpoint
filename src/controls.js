const { ipcRenderer } = require('electron')
import { CODE_DIGITS } from './consts.js'

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

function clearCode () {
  code.length = 0
  for (let i = 0; i < codeEls.length; i++) {
    codeEls[i].innerText = ''
  }
  hideFilename()
}
function showFilename (filename, tip) {
  filenameEl.innerText = filename
  tipEl.innerText = tip
}
function hideFilename () {
  filenameEl.innerText = ''
  tipEl.innerText = ''
}
function showInfo (imageSrc, title, subtitle) {
  infoImageEl.src = imageSrc
  infoTitleEl.innerText = title
  infoSubtitleEl.innerText = subtitle

  codeAreaEl.style.display = 'none'
  infoAreaEl.style.display = ''

  document.removeEventListener('keydown', handleCode)
}
function showOnce (imageSrc, title, subtitle) {
  showInfo(imageSrc, title, subtitle)
  document.addEventListener('keydown', handleError)
}
function hideInfo () {
  infoImageEl.src = ''
  infoTitleEl.innerText = ''
  infoSubtitleEl.innerText = ''

  clearCode()

  codeAreaEl.style.display = ''
  infoAreaEl.style.display = 'none'

  document.addEventListener('keydown', handleCode)
}

function handleCode (e) {
  e.preventDefault()
  console.log('Pressed 0x' + e.keyCode.toString(16))
  if (e.keyCode === 0x74) location.reload() // F5
  if (e.keyCode >= 0x30 && e.keyCode <= 0x39) { // number
    if (code.length === CODE_DIGITS) return
    const number = e.keyCode - 0x30
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
}

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
