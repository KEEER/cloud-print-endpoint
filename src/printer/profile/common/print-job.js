import { PrintConfiguration } from '../../../print-configuration'
import { printerStatus } from '../../../status'
import { print } from '../../../util'

const scale = { 'scale-to-fit': true }

export default async function* (fileEntry) {
  const config = new PrintConfiguration(fileEntry.config)
  const type = config.colored ? 'colored' : 'bw'
  const copies = config.copies
  const bwAddon = config.colored ? {} : { 'ColorModel': 'Gray' }
  if (config.doubleSided) {
    yield [ 'start' ]
    for (let i of Array(copies).keys()) {
      const allPages = [...Array(fileEntry.pageCount).keys()].map(p => p + 1)
      const pageRanges = [ allPages.filter(n => n % 2 === 0), allPages.filter(n => n % 2 === 1) ].map(r => r.join(','))
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
        ...scale,
        ...bwAddon,
      })
      await printerStatus[type].becomes('idle')
      yield [ 'done', i ]
    }
  } else {
    yield 'start'
    await print(fileEntry, { n: copies, ...bwAddon })
    await printerStatus[type].becomes('idle')
    yield 'done'
  }
}
