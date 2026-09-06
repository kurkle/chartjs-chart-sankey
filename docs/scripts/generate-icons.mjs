/**
 * Generates the full favicon / PWA icon set from a single source SVG.
 *
 * Reads docs/public/favicon.svg and writes:
 *   - favicon-96x96.png
 *   - apple-touch-icon.png (180x180)
 *   - web-app-manifest-192x192.png
 *   - web-app-manifest-512x512.png
 *   - favicon.ico (multi-resolution: 16, 32, 48)
 *
 * This script is intentionally generic (no project-specific values other
 * than the paths below), so it can be copied as-is into any repo that
 * follows the same docs/public/favicon.svg -> icon-set convention.
 *
 * Rasterization: sharp (libvips) renders the SVG to PNG at exact pixel
 * dimensions. ICO packaging: png-to-ico bundles multiple PNG buffers into
 * one multi-resolution .ico. Both were chosen because they run headless on
 * any platform (no native `sips`/ImageMagick dependency), sharp resolves
 * exact output dimensions the way `sips` cannot for SVG input, and neither
 * requires a build step (prebuilt binaries).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
const sourceSvg = path.join(publicDir, 'favicon.svg')

const pngTargets = [
  { file: 'favicon-96x96.png', size: 96 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'web-app-manifest-192x192.png', size: 192 },
  { file: 'web-app-manifest-512x512.png', size: 512 },
]

const icoSizes = [16, 32, 48]

async function renderPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 300 }).resize(size, size).png().toBuffer()
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  const svgBuffer = await readFile(sourceSvg)

  for (const { file, size } of pngTargets) {
    const buffer = await renderPng(svgBuffer, size)
    const outPath = path.join(publicDir, file)
    await writeFile(outPath, buffer)
    console.log(`wrote ${file} (${size}x${size})`)
  }

  const icoBuffers = await Promise.all(icoSizes.map((size) => renderPng(svgBuffer, size)))
  const ico = await pngToIco(icoBuffers)
  await writeFile(path.join(publicDir, 'favicon.ico'), ico)
  console.log(`wrote favicon.ico (${icoSizes.join('/')})`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
