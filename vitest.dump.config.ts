import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const out = process.env.DUMP_DIR as string
export default defineConfig({
  test: {
    browser: {
      commands: {
        dump(_ctx: unknown, name: string, dataUrl: string) {
          const file = join(out, name)
          mkdirSync(dirname(file), { recursive: true })
          writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
        },
      },
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
      provider: playwright({
        launchOptions: {
          args: ['--disable-accelerated-2d-canvas'],
          firefoxUserPrefs: { 'gfx.canvas.accelerated': false, 'layers.acceleration.disabled': true },
        },
      }),
      screenshotFailures: false,
    },
    globals: true,
    include: ['test/dump/**/*.spec.js'],
    setupFiles: ['test/setup.js'],
  },
})
