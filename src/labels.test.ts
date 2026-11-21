import type { CanvasFontSpec } from 'chart.js'
import type { DrawLabelOptions, MeasuredLabel } from './labels.js'
import type { SankeyNode } from './types.js'

import { drawLabel, measureLabel, paintLabels, resolveNodeOption } from './labels.js'

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
    translate: vi.fn(),
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
    expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 35, 30, undefined)
  })

  it('draws a padded background behind a centered label', () => {
    const ctx = createContext()

    drawLabel(ctx, 'A', createOptions({ backgroundColor: 'red', position: 'center' }))

    expect(ctx.fillRect).toHaveBeenCalledExactlyOnceWith(11, 21, 28, 18)
    expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('A', 25, 30, undefined)
  })

  describe('paintLabels', () => {
    const canvas = { height: 100, width: 100 }

    // a one-line label: 18 px tall and 28 px wide (text 20 x 10, padding 4); it may move 9 / 14 px
    function measure(
      position: 'left' | 'top' | 'center',
      at: number,
      label = 'A',
      extra: Partial<DrawLabelOptions> = {},
      ctx = createContext()
    ) {
      // left labels sit in a horizontal chart, top labels in a vertical one
      const orientation = position === 'top' ? 'vertical' : 'horizontal'
      const x = position === 'top' ? at : 40
      const y = position === 'top' ? 40 : at
      return measureLabel(
        ctx,
        label,
        createOptions({
          backgroundColor: 'red',
          canvas,
          height: 0,
          orientation,
          position,
          width: 0,
          x,
          y,
          ...extra,
        })
      ) as MeasuredLabel
    }

    /** Places labels (all in column 0 unless given) and returns where they end up. */
    function place(labels: MeasuredLabel[], columns: number[] = []) {
      paintLabels(labels.map((label, i) => ({ column: columns[i] ?? 0, label })))
      return labels.map((label) => label.start + label.shift)
    }

    it('does not move a label that fits and overlaps nothing', () => {
      const ctx = createContext()
      const [a, b] = [measure('left', 30, 'A', {}, ctx), measure('left', 70, 'A', {}, ctx)]

      expect(place([a, b])).toEqual([a.start, b.start])
      expect([a.shift, b.shift]).toEqual([0, 0])
      expect(ctx.translate).not.toHaveBeenCalled()
    })

    it('separates two labels that collide when the limit allows it, leaving a pixel', () => {
      const [a, b] = [measure('left', 50), measure('left', 55)]
      const [first, second] = place([a, b])

      expect(second - (first + a.size)).toBe(1)
      expect(a.shift).toBeLessThan(0)
      expect(b.shift).toBeGreaterThan(0)
    })

    it('shares the overlap when the limit is too tight to separate them', () => {
      const [a, b] = [measure('left', 50), measure('left', 50)]

      place([a, b])

      expect(a.shift).toBe(-9)
      expect(b.shift).toBe(9)
    })

    it('settles a chain in order and never beyond the limit, however dense the column', () => {
      const labels = Array.from({ length: 12 }, (_, i) => measure('left', 50 + i))
      const starts = place(labels)

      expect(starts).toEqual([...starts].sort((x, y) => x - y))
      for (const label of labels) expect(Math.abs(label.shift)).toBeLessThanOrEqual(9 + 1e-9)
    })

    it('keeps a label inside the canvas, which wins over the limit', () => {
      const [top, bottom] = [measure('left', -30), measure('left', 140)]

      place([top, bottom])

      expect(top.start + top.shift).toBe(0)
      expect(bottom.start + bottom.shift + bottom.size).toBe(100)
    })

    it('measures the limit of a neighbour from its own node, not from the clamped label', () => {
      const [edge, next] = [measure('left', -20), measure('left', 22)]

      place([edge, next])

      expect(edge.start + edge.shift).toBe(0)
      expect(Math.abs(next.shift)).toBeLessThanOrEqual(9)
    })

    it('shifts a multi-line label by its whole box and draws it there', () => {
      const ctx = createContext()
      const label = measure('left', 99, 'A\nB\nC', {}, ctx)

      place([label])

      expect(label.start + label.shift + label.size).toBe(100)
      expect(ctx.translate).toHaveBeenCalledExactlyOnceWith(0, label.shift)
    })

    it('keeps a label that is larger than the canvas aligned to the start', () => {
      const label = measure('left', 50, 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ')

      place([label])

      expect(label.start + label.shift).toBe(0)
    })

    it('only compares labels of the same column and side', () => {
      const labels = [
        measure('left', 50),
        measure('left', 50),
        measure('left', 50),
        measure('left', 50, 'A', { position: 'right' }),
        measure('left', 50),
      ]

      place(labels, [0, 1, 0, 0, 0])

      expect(labels[1].shift).toBe(0)
      expect(labels[3].shift).toBe(0)
      expect(labels[0].shift).not.toBe(0)
    })

    it('nudges and clamps along x in a vertical chart', () => {
      const [a, b] = [measure('top', 50), measure('top', 52)]
      const [first, second] = place([a, b])
      const edge = measure('top', 99)

      place([edge])

      expect(second - (first + a.size)).toBe(1)
      expect(edge.start + edge.shift + edge.size).toBe(100)
    })

    it('also keeps a label inside the canvas along the column axis, without nudging', () => {
      const leftCtx = createContext()
      const rightCtx = createContext()
      const left = measure('left', 50, 'A', { x: 5 }, leftCtx) // sticks out 24 px on the left
      const right = measure('left', 50, 'A', { position: 'right', x: 95 }, rightCtx)

      place([left])
      place([right])

      expect(leftCtx.translate).toHaveBeenCalledExactlyOnceWith(24, 0)
      expect(rightCtx.translate).toHaveBeenCalledExactlyOnceWith(-24, 0)
    })

    it('counts only the glyphs without a background, padding with one', () => {
      const ctx = createContext()
      vi.mocked(ctx.measureText).mockReturnValue({
        actualBoundingBoxAscent: 6,
        actualBoundingBoxDescent: 2,
        width: 20,
      } as TextMetrics)

      const plain = measure('left', 50, 'A', { backgroundColor: undefined }, ctx)
      const boxed = measure('left', 50, 'A', {}, ctx)

      expect(plain.size).toBe(8)
      expect(boxed.size).toBe(18)
    })
  })

  it('does not measure an empty label', () => {
    expect(measureLabel(createContext(), '', createOptions())).toBeUndefined()
  })
})
