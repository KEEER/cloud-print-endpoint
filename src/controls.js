const { ipcRenderer } = require('electron')

const $ = function (name) { return document.querySelector(name) }

const code = []
const codeEls = [ $('#num0'), $('#num1'), $('#num2'), $('#num3') ]
const codeAreaEl = $('#code-area')
const infoAreaEl = $('#info-area')
const filenameEl = $('#filename')
const tipEl = $('#tip')
const infoImageEl = $('#info-image')
const infoTitleEl = $('#info-title')
const infoSubtitleEl = $('#info-subtitle')

const CODE_DIGITS = 4

function clearCode () {
  code.length = 0
  for (let i = 0; i < codeEls.length; i++) {
    codeEls[i].innerText = ''
  }
  hideFilename()
}
function showFilename (filename) {
  filenameEl.innerText = filename
  tipEl.style.visibility = ''
}
function hideFilename () {
  filenameEl.innerText = ''
  tipEl.style.visibility = 'hidden'
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

function sendPrintRequest () {
  // TODO
  return new Promise((resolve, reject) => {
    ipcRenderer.once('print-reply', (_e, reply) => {
      if (typeof reply !== 'boolean') return reject(reply)
      if(reply) ipcRenderer.once('print-done', _e => {
        showOnce('./img/done.svg', '打印完成！', '请按回车键以继续')
      })
      resolve(reply)
    })
    ipcRenderer.send('print', code)
  })
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
      const filename = 'File ' + code.join('') + '.pdf'
      showFilename(filename)
    }
  }
  if (e.keyCode === 0x08 || e.keyCode === 0x2e) { // bksp
    if (code.length === 0) return
    codeEls[code.length - 1].innerText = ''
    code.pop()
    hideFilename()
  }
  if (e.keyCode === 0x0d && code.length === 4) { // enter
    sendPrintRequest().then(function (res) {
      if (res) showInfo('./img/print.svg', '正在打印中，请稍候', '页面 1 / 1')
      else showOnce('./img/error.svg', '未知错误', '请按回车键以继续')
    }).catch(function (name) {
      showOnce('./img/error.svg', '未知错误: ' + name, '请按回车键以继续')
    })
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
