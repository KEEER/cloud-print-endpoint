import { PrintConfiguration } from '../../../print-configuration'
import { printerStatus } from '../../../status'
import { print } from '../../../util'

const scale = { 'scale-to-fit': true }

export default async function* (fileEntry) {
  const config = new PrintConfiguration(fileEntry.config)
  const type = config.colored ? 'colored' : 'bw'
  const copies = config.copies
  const bwAddon = config.colored ? {} : { 'CNGrayscale': 'True' }
  if (config.doubleSided) {
    yield [ 'start' ]
    for (let i of Array(copies).keys()) {
      const allPages = [...Array(fileEntry.pageCount).keys()].map(p => p + 1)
      const pageRanges = [ allPages.filter(n => n % 2 === 0), allPages.filter(n => n % 2 === 1) ].map(r => r.join(','))
      if (fileEntry.pageCount % 2 === 1) {
        await print({ id: 'empty', config })
        await printerStatus[type].becomes('idle')
      }
      await print(fileEntry, {
        'page-ranges': pageRanges[0],
        outputorder: 'reverse',
        ...scale,
        ...bwAddon,
      })
      await printerStatus[type].becomes('idle')
      yield [ 'second-side', i ]
      await print(fileEntry, {
        'page-ranges': pageRanges[1],
        'orientation-requested': 6,
        outputorder: 'reverse',
        ...scale,
        ...bwAddon,
      })
      await printerStatus[type].becomes('idle')
      yield [ 'done', i ]
    }
  } else {
    yield 'start'
    await print(fileEntry, {
      n: copies,
      outputorder: 'reverse',
      ...bwAddon,
    })
    await printerStatus[type].becomes('idle')
    yield 'done'
  }
}
