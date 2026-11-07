import { _electron, expect, test } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('brand resources and every Windows icon size contain neutral grayscale pixels', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-brand-'))
  const application = await _electron.launch({ executablePath: require('electron'), args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
    const files = ['src/renderer/src/assets/workpack-logo.png', 'src/renderer/public/icon.png', 'out/renderer/icon.png', 'docs/assets/workpack-logo-on-light.png', 'docs/assets/social-preview.png']
    const inputs = files.map(name => ({ name, data: fs.readFileSync(path.resolve(name)).toString('base64') }))
    const icon = fs.readFileSync(path.resolve('build/icon.ico'))
    for (let index = 0; index < icon.readUInt16LE(4); index++) {
      const entry = 6 + index * 16
      const start = icon.readUInt32LE(entry + 12)
      inputs.push({ name: `ICO ${icon[entry] || 256}`, data: icon.subarray(start, start + icon.readUInt32LE(entry + 8)).toString('base64') })
    }
    const resources = await application.evaluate(({ nativeImage }, inputs) => {
      function inspect(name: string, buffer: Buffer) {
        const image = nativeImage.createFromBuffer(buffer)
        const bytes = image.toBitmap()
        let colored = 0, visible = 0, transparent = 0
        for (let offset = 0; offset < bytes.length; offset += 4) {
          if (bytes[offset + 3] === 0) { transparent++; continue }
          visible++
          if (bytes[offset] !== bytes[offset + 1] || bytes[offset + 1] !== bytes[offset + 2]) colored++
        }
        return { name, ...image.getSize(), colored, visible, transparent }
      }
      return inputs.map(input => inspect(input.name, Buffer.from(input.data, 'base64')))
    }, inputs)
    expect(resources.filter(resource => resource.name.startsWith('ICO')).map(resource => resource.width)).toEqual([16, 24, 32, 48, 64, 128, 256])
    for (const resource of resources) {
      expect(resource.colored, resource.name).toBe(0)
      expect(resource.visible, resource.name).toBeGreaterThan(0)
    }
    const runtime = resources.find(resource => resource.name === 'out/renderer/icon.png')!
    expect(runtime.width).toBe(256)
    expect(runtime.transparent).toBeGreaterThan(0)
    await expect(page.locator('.footer-emblem img')).toHaveCSS('filter', 'none')
  } finally {
    await application.close()
    const resolved = path.resolve(root)
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpack-brand-')) fs.rmSync(resolved, { recursive: true, force: true })
  }
})
