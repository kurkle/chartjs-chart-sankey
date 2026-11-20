import type { CanvasFontSpec } from 'chart.js'
import type { DrawLabelOptions, MeasuredLabel } from './labels.js'
import type { SankeyNode } from './types.js'

import {
  drawLabel,
  measureLabel,
  paintLabel,
  resolveLabelColumns,
  resolveLabelOverlaps,
  resolveNodeOption,
  resolveSpans,
} from './labels.js'

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

  describe('resolveSpans', () => {
    // 10 px spans: each may move 5 px (half its size) and keeps a 1 px gap
    const span = (start: number) => ({ size: 10, start })

    it('leaves spans that do not overlap where they are', () => {
      expect(resolveSpans([span(5), span(20)], 0, 100)).toEqual([5, 20])
    })

    it('separates two spans that collide when the limit allows it', () => {
      // wished 40 and 45: they overlap by 6 including the gap, each moves 3
      expect(resolveSpans([span(40), span(45)], 0, 100)).toEqual([37, 48])
    })

    it('settles a chain of collisions within the limit', () => {
      const [a, b, c] = resolveSpans([span(40), span(44), span(48)], 0, 100)

      expect(a).toBeGreaterThanOrEqual(35)
      expect(c).toBeLessThanOrEqual(53)
      expect(b).toBeGreaterThanOrEqual(39)
      expect(b).toBeLessThanOrEqual(49)
      expect(a).toBeLessThan(b)
      expect(b).toBeLessThan(c)
    })

    it('shares the overlap when the limit is too tight to separate them', () => {
      // same wished start: each can move 5, which leaves them 1 px overlapping, not hidden
      const [a, b] = resolveSpans([span(50), span(50)], 0, 100)

      expect(a).toBe(45)
      expect(b).toBe(55)
    })

    it('never moves a span further than the limit, however dense the column', () => {
      const wished = Array.from({ length: 12 }, (_, i) => 50 + i)
      const starts = resolveSpans(wished.map(span), 0, 100)

      starts.forEach((start, i) => {
        expect(Math.abs(start - wished[i])).toBeLessThanOrEqual(5 + 1e-9)
      })
      expect(starts).toEqual([...starts].sort((x, y) => x - y))
    })

    it('does not move an unrelated span when its neighbours collide', () => {
      expect(resolveSpans([span(0), span(50), span(52), span(90)], 0, 100)).toEqual([
        0, 45.5, 56.5, 90,
      ])
    })

    it('lets the bounds win over the limit', () => {
      expect(resolveSpans([span(-40)], 0, 100)).toEqual([0])
      expect(resolveSpans([span(140)], 0, 100)).toEqual([90])
    })

    it('measures the limit of a neighbour from where it wished to be, not from the clamped edge label', () => {
      // the first is pulled 20 px by the bound; the second still moves at most 5 px from its own start
      const [a, b] = resolveSpans([span(-20), span(8)], 0, 100)

      expect(a).toBe(0)
      expect(b).toBeGreaterThanOrEqual(8)
      expect(b).toBeLessThanOrEqual(13)
    })

    it('keeps a span larger than the room aligned to the start', () => {
      expect(resolveSpans([{ size: 50, start: 30 }], 0, 20)).toEqual([0])
    })

    it('keeps every span inside the bounds when they are together larger than the room', () => {
      const starts = resolveSpans([span(0), span(5), span(10)], 0, 20)

      for (const start of starts) {
        expect(start).toBeGreaterThanOrEqual(0)
        expect(start).toBeLessThanOrEqual(10)
      }
    })
  })

  describe('node labels in a column', () => {
    const bounds = { bottom: 100, left: 0, right: 100, top: 0 }

    function measure(position: 'left' | 'top', y: number, label = 'A', extra = {}) {
      const ctx = createContext()
      const options = createOptions({
        backgroundColor: 'red',
        height: 0,
        position,
        width: 0,
        x: position === 'top' ? y : 40,
        y: position === 'top' ? 40 : y,
        ...extra,
      })
      return measureLabel(ctx, label, options) as MeasuredLabel
    }

    it('measures the box that is drawn', () => {
      const ctx = createContext()
      const measured = measureLabel(
        ctx,
        'A',
        createOptions({ backgroundColor: 'red', position: 'center' })
      ) as MeasuredLabel

      paintLabel(ctx, measured)

      expect(ctx.fillRect).toHaveBeenCalledExactlyOnceWith(
        measured.box.x,
        measured.box.y,
        measured.box.width,
        measured.box.height
      )
    })

    it('does not measure an empty label', () => {
      expect(measureLabel(createContext(), '', createOptions())).toBeUndefined()
    })

    it('moves two overlapping labels apart and leaves a lone one alone', () => {
      const labels = [measure('left', 50), measure('left', 55), measure('left', 90)]

      resolveLabelOverlaps(labels, bounds)

      expect(labels[0].shift.y).toBe(-7)
      expect(labels[1].shift.y).toBe(7)
      expect(labels[2].shift.y).toBe(0)
    })

    it('leaves a gap of one pixel between labels that were pushed apart', () => {
      const labels = [measure('left', 50), measure('left', 52)]

      resolveLabelOverlaps(labels, bounds)

      const [first, second] = labels.map((label) => label.box.y + label.shift.y)
      expect(second - (first + labels[0].box.height)).toBe(1)
    })

    it('shifts multi-line labels by their whole box and draws them there', () => {
      const ctx = createContext()
      const a = measureLabel(
        ctx,
        'A\nB',
        createOptions({ backgroundColor: 'red', height: 0, y: 99 })
      )
      const labels = [a as MeasuredLabel]

      resolveLabelOverlaps(labels, bounds)
      paintLabel(ctx, labels[0])

      expect(labels[0].box.y + labels[0].shift.y + labels[0].box.height).toBe(100)
      expect(vi.mocked(ctx.fillRect).mock.calls[0][1]).toBe(72)
    })

    it('resolves vertical-chart labels along the x axis', () => {
      const labels = [measure('top', 50), measure('top', 52)]

      resolveLabelOverlaps(labels, bounds)

      expect(labels[0].shift.x).toBeLessThan(0)
      expect(labels[1].shift.x).toBeGreaterThan(0)
      expect(labels[0].shift.y).toBe(0)
      expect(labels[0].box.x + labels[0].shift.x + labels[0].box.width).toBeLessThanOrEqual(
        labels[1].box.x + labels[1].shift.x
      )
    })

    it('counts the padding only when there is a background', () => {
      const withBackground = measure('left', 50)
      const without = measure('left', 50, 'A', { backgroundColor: undefined })

      expect(withBackground.box.height).toBe(18)
      expect(without.box.height).toBe(10)
    })

    it('keeps columns and sides apart and skips center labels', () => {
      const a = measure('left', 50)
      const b = measure('left', 50)
      const otherColumn = measure('left', 50)
      const centered = measure('left', 50, 'A', { position: 'center' })

      resolveLabelColumns(
        [
          { column: 0, label: a },
          { column: 0, label: b },
          { column: 1, label: otherColumn },
          { column: 0, label: centered },
        ],
        bounds
      )

      expect(a.shift.y).not.toBe(0)
      expect(b.shift.y).not.toBe(0)
      expect(otherColumn.shift.y).toBe(0)
      expect(centered.shift.y).toBe(0)
    })

    it('does nothing for an empty column', () => {
      expect(() => resolveLabelOverlaps([], bounds)).not.toThrow()
    })
  })
})
