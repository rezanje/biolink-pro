// Uji pengenalan target MindAR (jalur CPU) pada "foto kamera" sintetis.
// Usage: node detect-test.mjs <target.png> <target.mind>
import fs from 'node:fs'
import zlib from 'node:zlib'
import * as tf from '@tensorflow/tfjs'
import { decode } from '@msgpack/msgpack'
import { Detector } from 'mind-ar/src/image-target/detector/detector.js'
import { Matcher } from 'mind-ar/src/image-target/matching/matcher.js'
import { Estimator } from 'mind-ar/src/image-target/estimation/estimator.js'
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js'

function decodePngGrey(buf) {
  let p = 8, w, h, ct, idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9] }
    if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp
  const out = new Float32Array(w * h), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0
      let v = cur[x]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      cur[x] = v & 255
    }
    for (let x = 0; x < w; x++) out[y * w + x] = (cur[x * bpp] + cur[x * bpp + 1] + cur[x * bpp + 2]) / 3
    cur.copy(prev)
  }
  return { w, h, data: out }
}

// Homografi dari 4 titik (target -> layar)
function homography(src, dst) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  for (let i = 0; i < 8; i++) { // eliminasi Gauss
    let m = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r
    ;[A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]]
    for (let r = 0; r < 8; r++) if (r !== i) { const k = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= k * A[i][c]; b[r] -= k * b[i] }
  }
  const h = b.map((v, i) => v / A[i][i]); return [...h, 1]
}
const apply = (H, x, y) => { const d = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d] }
function invert3(H) {
  const [a, b, c, d, e, f, g, h, i] = H, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map(v => v / det)
}

let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
function noiseBg(W, H) { // latar acak halus (bukan target)
  const g = new Float32Array(W * H), cells = 24
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, () => 60 + rnd() * 140)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = x / W * cells, gy = y / H * cells, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy
    const v = grid[iy * (cells + 1) + ix] * (1 - fx) * (1 - fy) + grid[iy * (cells + 1) + ix + 1] * fx * (1 - fy) + grid[(iy + 1) * (cells + 1) + ix] * (1 - fx) * fy + grid[(iy + 1) * (cells + 1) + ix + 1] * fx * fy
    g[y * W + x] = v + (rnd() - 0.5) * 20
  }
  return g
}

function frame(target, corners, { W = 640, H = 480, gain = 1, bias = 0 } = {}) {
  const img = noiseBg(W, H)
  if (corners) {
    const Hm = homography([[0, 0], [target.w, 0], [target.w, target.h], [0, target.h]], corners), Hi = invert3(Hm)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [tx, ty] = apply(Hi, x, y)
      if (tx < 0 || ty < 0 || tx >= target.w - 1 || ty >= target.h - 1) continue
      const x0 = Math.floor(tx), y0 = Math.floor(ty), fx = tx - x0, fy = ty - y0, t = target.data, w = target.w
      const v = t[y0 * w + x0] * (1 - fx) * (1 - fy) + t[y0 * w + x0 + 1] * fx * (1 - fy) + t[(y0 + 1) * w + x0] * (1 - fx) * fy + t[(y0 + 1) * w + x0 + 1] * fx * fy
      img[y * W + x] = Math.max(0, Math.min(255, v * gain + bias + (rnd() - 0.5) * 12))
    }
  }
  return img
}

const [pngPath, mindPath] = process.argv.slice(2)
await tf.setBackend('cpu')
const target = decodePngGrey(fs.readFileSync(pngPath))
const { dataList } = decode(fs.readFileSync(mindPath))
const matchingData = dataList[0].matchingData
const W = 640, H = 480, f = (H / 2) / Math.tan(22.5 * Math.PI / 180)
const K = [[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]]
const detector = new Detector(W, H), matcher = new Matcher(W, H), estimator = new Estimator(K)

function run(name, corners, opts) {
  const img = frame(target, corners, opts)
  const { featurePoints } = tf.tidy(() => detector.detect(tf.tensor(img, [H, W], 'float32')))
  const r = matcher.matchDetection(matchingData, featurePoints)
  let err = null, found = false
  if (r.keyframeIndex !== -1) {
    const mv = estimator.estimate({ screenCoords: r.screenCoords, worldCoords: r.worldCoords })
    if (mv) {
      found = true
      const proj = ([x, y]) => { const X = mv[0][0] * x + mv[0][1] * y + mv[0][3], Y = mv[1][0] * x + mv[1][1] * y + mv[1][3], Z = mv[2][0] * x + mv[2][1] * y + mv[2][3]; return [(K[0][0] * X + K[0][2] * Z) / Z, (K[1][1] * Y + K[1][2] * Z) / Z] }
      if (corners) err = Math.max(...[[0, 0], [target.w, 0], [target.w, target.h], [0, target.h]].map((c, i) => { const p = proj(c); return Math.hypot(p[0] - corners[i][0], p[1] - corners[i][1]) }))
    }
  }
  return { name, featurePoints: featurePoints.length, found, matches: r.screenCoords?.length || 0, cornerErrPx: err === null ? null : Number(err.toFixed(1)) }
}

const results = [
  run('lurus di tengah', [[160, 140], [480, 140], [480, 342], [160, 342]]),
  run('miring perspektif ~30°', [[170, 120], [470, 150], [500, 360], [140, 330]]),
  run('diputar ~20°', [[200, 100], [490, 205], [430, 380], [140, 275]]),
  run('kecil (jauh)', [[250, 190], [390, 190], [390, 278], [250, 278]]),
  run('redup', [[160, 140], [480, 140], [480, 342], [160, 342]], { gain: 0.55, bias: 10 }),
  run('tanpa kartu (latar saja)', null),
]
for (const r of results) console.log(JSON.stringify(r))
