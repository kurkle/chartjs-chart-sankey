import { describe, expect, test } from '@jest/globals'

import { readFileSync } from 'node:fs'

describe('package metadata', () => {
  test('points browser CDNs to the auto-registering UMD bundle', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

    expect(pkg.jsdelivr).toBe('dist/chartjs-chart-sankey.min.js')
    expect(pkg.unpkg).toBe('dist/chartjs-chart-sankey.min.js')
  })

  test('rebuilds distributable files when packing a release', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

    expect(pkg.scripts.prepack).toBe('npm run build')
  })
})
