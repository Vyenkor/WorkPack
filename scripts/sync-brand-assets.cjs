// Export the existing logo system with the same grayscale treatment as the UI.
// Run with Node; the Electron worker supplies the project's native PNG codec.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')

if (!process.versions.electron) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  process.exit(result.status ?? 1)
}

const { app, nativeImage } = require('electron')

function grayscale(png) {
  const source = nativeImage.createFromBuffer(png)
  if (source.isEmpty()) throw new Error('Cannot decode brand asset')
  const { width, height } = source.getSize()
  const bitmap = source.toBitmap()
  let changed = false
  for (let offset = 0; offset < bitmap.length; offset += 4) {
    if (bitmap[offset] !== bitmap[offset + 1] || bitmap[offset + 1] !== bitmap[offset + 2]) changed = true
    // Electron exposes BGRA. These weights match CSS grayscale(1).
    const gray = Math.round(bitmap[offset] * 0.0722 + bitmap[offset + 1] * 0.7152 + bitmap[offset + 2] * 0.2126)
    bitmap[offset] = bitmap[offset + 1] = bitmap[offset + 2] = gray
  }
  if (!changed) return png
  return nativeImage.createFromBitmap(bitmap, { width, height }).toPNG()
}

function sync() {
  for (const name of ['src/renderer/src/assets/workpack-logo.png', 'docs/assets/workpack-logo-on-light.png', 'docs/assets/social-preview.png']) {
    const file = path.join(root, name)
    fs.writeFileSync(file, grayscale(fs.readFileSync(file)))
  }
  const iconFile = path.join(root, 'build/icon.ico')
  const original = fs.readFileSync(iconFile)
  const count = original.readUInt16LE(4)
  if (original.readUInt16LE(0) !== 0 || original.readUInt16LE(2) !== 1 || !count) throw new Error('Invalid ICO header')
  const directory = Buffer.from(original.subarray(0, 6 + count * 16))
  let offset = directory.length
  const frames = []
  let runtimeIcon
  let largestSize = 0
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16
    const start = original.readUInt32LE(entry + 12)
    const size = original.readUInt32LE(entry + 8)
    const png = original.subarray(start, start + size)
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Expected PNG-compressed icon frame')
    const gray = grayscale(png)
    directory.writeUInt32LE(gray.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    frames.push(gray)
    offset += gray.length
    const width = original[entry] || 256
    if (width > largestSize) { largestSize = width; runtimeIcon = gray }
  }
  if (!runtimeIcon || largestSize < 256) throw new Error('Missing high-resolution icon')
  fs.writeFileSync(iconFile, Buffer.concat([directory, ...frames]))
  fs.writeFileSync(path.join(root, 'src/renderer/public/icon.png'), runtimeIcon)
  process.stdout.write(`Updated grayscale branding and ${count} ICO sizes.\n`)
}

app.whenReady().then(() => { sync(); app.quit() }).catch(error => { process.stderr.write(String(error) + '\n'); app.exit(1) })
