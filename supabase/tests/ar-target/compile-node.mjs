// Susun target MindAR (.mind) dari PNG lewat jalur CPU, tanpa paket canvas.
// Usage (dari folder yang punya mind-ar terpasang, lihat README): node compile-node.mjs <input.png> <output.mind>
import fs from 'node:fs'
import zlib from 'node:zlib'
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js'
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js'
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js'
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js'

// PNG 8-bit RGB/RGBA tanpa interlace -> RGBA
function decodePng(buf) {
  let p = 8, w, h, ct, idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG tidak didukung') }
    if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : null
  if (!bpp) throw new Error('Tipe warna PNG tidak didukung: ' + ct)
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0
      let v = cur[x]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      cur[x] = v & 255
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2]; out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255 }
    cur.copy(prev)
  }
  return { width: w, height: h, data: out }
}

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    return { getContext: () => ({ drawImage() {}, getImageData: () => ({ data: img.data }) }) }
  }
  compileTrack({ progressCallback, targetImages, basePercent }) {
    const list = targetImages.map(t => extractTrackingFeatures(buildTrackingImageList(t), () => {}))
    progressCallback(100)
    return Promise.resolve(list)
  }
}

const [input, output] = process.argv.slice(2)
const img = decodePng(fs.readFileSync(input))
console.log('gambar', img.width, 'x', img.height)
const c = new NodeCompiler()
let last = -10
await c.compileImageTargets([img], p => { if (p - last >= 10) { last = p; console.log('progress', p.toFixed(0)) } })
const buf = c.exportData()
fs.writeFileSync(output, Buffer.from(buf))
const d = c.data[0]
console.log('selesai', output, buf.byteLength, 'byte · titik pencocokan', d.matchingData.reduce((n, m) => n + m.maximaPoints.length + m.minimaPoints.length, 0), '· titik tracking', d.trackingData.reduce((n, t) => n + t.points.length, 0))
