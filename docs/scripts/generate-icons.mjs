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
 *
 * The two web-app-manifest-*.png files are declared `purpose: maskable` in
 * site.webmanifest: platforms (Android adaptive icons, etc.) crop them to a
 * circle/squircle/rounded-square of their own choosing, so artwork that runs
 * close to the edge gets clipped. Those two are rendered smaller and padded
 * back out to full size (MASKABLE_SAFE_ZONE / MASKABLE_BACKGROUND below) so
 * the mark sits inside the safe zone platforms expect. The non-maskable
 * targets (favicon-96x96, apple-touch-icon, the .ico sizes) are rendered
 * full-bleed as before — shrinking those too would just make the mark
 * smaller for no reason, since nothing masks them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
const sourceSvg = path.join(publicDir, 'favicon.svg')

// Fraction of the full canvas the artwork occupies in a maskable render.
// 0.8 leaves a 10% margin on every edge, which is the safe-zone platforms
// generally assume for maskable/adaptive icons (content inside the centered
// 80%-diameter circle survives any mask shape). Tune per-repo if a given
// mark's own bounding box needs more or less room.
const MASKABLE_SAFE_ZONE = 0.8

// Fill color for the safe-zone margin and for any transparency inside the
// shrunk artwork itself, so the icon reads as one flat opaque square under a
// mask rather than showing checkerboard/whatever-the-platform-picks through
// transparent pixels. Matches site.webmanifest's background_color.
const MASKABLE_BACKGROUND = '#ffffff'

const pngTargets = [
  { file: 'favicon-96x96.png', size: 96 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'web-app-manifest-192x192.png', size: 192, maskable: true },
  { file: 'web-app-manifest-512x512.png', size: 512, maskable: true },
]

const icoSizes = [16, 32, 48]

async function renderPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 300 }).resize(size, size).png().toBuffer()
}

async function renderMaskablePng(svgBuffer, size) {
  const innerSize = Math.round(size * MASKABLE_SAFE_ZONE)
  const margin = size - innerSize
  const before = Math.floor(margin / 2)
  const after = margin - before

  const artwork = await sharp(svgBuffer, { density: 300 })
    .resize(innerSize, innerSize)
    .flatten({ background: MASKABLE_BACKGROUND })
    .png()
    .toBuffer()

  return sharp(artwork)
    .extend({
      top: before,
      bottom: after,
      left: before,
      right: after,
      background: MASKABLE_BACKGROUND,
    })
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  const svgBuffer = await readFile(sourceSvg)

  for (const { file, size, maskable } of pngTargets) {
    const buffer = maskable
      ? await renderMaskablePng(svgBuffer, size)
      : await renderPng(svgBuffer, size)
    const outPath = path.join(publicDir, file)
    await writeFile(outPath, buffer)
    console.log(`wrote ${file} (${size}x${size}${maskable ? ', maskable safe zone' : ''})`)
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
