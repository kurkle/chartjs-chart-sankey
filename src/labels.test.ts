import type { CanvasFontSpec } from 'chart.js'
import type { DrawLabelOptions } from './labels.js'
import type { SankeyNode } from './types.js'

import { drawLabel, resolveNodeOption } from './labels.js'

const node = { key: 'A' } as SankeyNode

function createContext() {
  return {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    font: '',
    lineTo: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 20 } as TextMetrics),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

function createOptions(overrides: Partial<DrawLabelOptions> = {}): DrawLabelOptions {
  return {
    autoPosition: 'right',
    borderRadius: 0,
    borderWidth: 1,
    color: 'black',
    font: {
      family: 'Arial',
      lineHeight: 10,
      size: 10,
      string: '10px Arial',
      style: 'normal',
      weight: 'normal',
    } as CanvasFontSpec,
    height: 20,
    lineOffset: 5,
    padding: 4,
    position: 'auto',
    width: 10,
    x: 20,
    y: 20,
    ...overrides,
  }
}

describe('node labels', () => {
  it('resolves static, mapped, and callback options', () => {
    const mapped = Object.assign(Object.create(null), { A: 'right' })

    expect(resolveNodeOption('left', node)).toBe('left')
    expect(resolveNodeOption(mapped, node)).toBe('right')
    expect(
      resolveNodeOption((item: SankeyNode) => (item.key === 'A' ? 'top' : 'bottom'), node)
    ).toBe('top')
  })

  it('returns a CanvasGradient-like object as-is instead of indexing into it', () => {
    // node environment has no real CanvasGradient; fake the string tag that
    // isPatternOrGradient() actually switches on.
    const gradient = { [Symbol.toStringTag]: 'CanvasGradient' }

    expect(resolveNodeOption(gradient, node)).toBe(gradient)
  })

  it('uses the right side for auto-positioned nodes in the left half', () => {
    const ctx = createContext()

    drawLabel(ctx, 'A', createOptions())

    expect(ctx.textAlign).toBe('left')
    expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 30)
  })

  it('draws a padded background behind a centered label', () => {
    const ctx = createContext()

    drawLabel(ctx, 'A', createOptions({ backgroundColor: 'red', position: 'center' }))

    expect(ctx.fillRect).toHaveBeenCalledExactlyOnceWith(11, 21, 28, 18)
    expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 25, 30)
  })
})
