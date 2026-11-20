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

  describe('keeping the label inside bounds', () => {
    // one-line label: box is 28 wide and 18 tall (text 20 wide, 10 tall, padding 4)
    const bounds = { bottom: 100, left: 0, right: 100, top: 0 }

    function boxOf(ctx: CanvasRenderingContext2D) {
      const [x, y, width, height] = vi.mocked(ctx.fillRect).mock.calls[0]
      return { bottom: y + height, left: x, right: x + width, top: y }
    }

    it('leaves a label that fits where it was', () => {
      const ctx = createContext()

      drawLabel(ctx, 'A', createOptions({ backgroundColor: 'red', bounds, y: 40 }))

      expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 50)
      expect(boxOf(ctx)).toEqual({ bottom: 59, left: 31, right: 59, top: 41 })
    })

    it('shifts a label down or up when it sticks out above or below', () => {
      const above = createContext()
      drawLabel(above, 'A', createOptions({ backgroundColor: 'red', bounds, height: 0, y: 2 }))
      const below = createContext()
      drawLabel(below, 'A', createOptions({ backgroundColor: 'red', bounds, height: 0, y: 99 }))

      expect(boxOf(above).top).toBe(0)
      expect(above.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 9)
      expect(boxOf(below).bottom).toBe(100)
      expect(below.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 91)
    })

    it('shifts a multi-line label by its whole box', () => {
      const ctx = createContext()

      drawLabel(ctx, 'A\nB\nC', createOptions({ backgroundColor: 'red', bounds, height: 0, y: 99 }))

      expect(boxOf(ctx).bottom).toBe(100)
      expect(vi.mocked(ctx.fillText).mock.calls.map((call) => call[2])).toEqual([71, 81, 91])
    })

    it('shifts a label sideways when it sticks out left or right', () => {
      const left = createContext()
      drawLabel(
        left,
        'A',
        createOptions({ backgroundColor: 'red', bounds, position: 'top', width: 0, x: 1 })
      )
      const right = createContext()
      drawLabel(
        right,
        'A',
        createOptions({ backgroundColor: 'red', bounds, position: 'bottom', width: 0, x: 99 })
      )

      expect(boxOf(left).left).toBe(0)
      expect(boxOf(right).right).toBe(100)
      expect(right.fillText).toHaveBeenCalledExactlyOnceWith('A', 86, expect.any(Number))
    })

    it('keeps a label that is larger than the bounds aligned to the start', () => {
      const ctx = createContext()

      drawLabel(
        ctx,
        'A',
        createOptions({
          backgroundColor: 'red',
          bounds: { bottom: 10, left: 0, right: 100, top: 0 },
          y: 50,
        })
      )

      expect(boxOf(ctx).top).toBe(0)
    })

    it('does nothing without bounds', () => {
      const ctx = createContext()

      drawLabel(ctx, 'A', createOptions({ height: 0, y: 99 }))

      expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 99)
    })
  })
})
