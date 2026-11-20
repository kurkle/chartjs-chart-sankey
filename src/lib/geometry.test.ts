import { computeGeometry, fitColumn, solveScale, toXY } from './geometry.js'
import { buildTopology } from './topology.js'

const flows = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'C' },
  { flow: 4, from: 'B', to: 'D' },
]

function input(over: Record<string, unknown> = {}) {
  const plan = buildTopology(flows, {})
  const keys = [...plan.nodes.keys()]
  return {
    input: {
      area: { bottom: 100, left: 0, right: 200, top: 0 },
      borderWidth: 0,
      gaps: new Map(keys.map((key) => [key, { after: 10, before: 10 }])),
      insets: { end: 0, start: 0 },
      minSizes: new Map(keys.map((key) => [key, 0])),
      nodeWidth: 10,
      orientation: 'horizontal' as const,
      paddingMode: 'auto' as const,
      ...over,
    },
    plan,
  }
}

describe('lib/geometry', () => {
  describe('solveScale', () => {
    it('divides the space by the units', () => {
      expect(
        solveScale(
          [
            { min: 0, size: 5 },
            { min: 0, size: 5 },
          ],
          50
        )
      ).toBe(5)
    })

    it('freezes nodes below their minimum and solves again for the others', () => {
      // 100px: the small node is held at 10px, the other gets the remaining 90
      const k = solveScale(
        [
          { min: 10, size: 1 },
          { min: 0, size: 9 },
        ],
        100
      )
      expect(k).toBe(10)
    })

    it('has no limit for an empty column and never goes negative', () => {
      expect(solveScale([], 10)).toBe(Number.POSITIVE_INFINITY)
      expect(solveScale([{ min: 0, size: 1 }], -5)).toBe(0)
    })
  })

  describe('fitColumn', () => {
    it('keeps nodes that do not collide at their ideal positions', () => {
      expect(fitColumn([0, 50], [1, 1], [0, 20], 100, false)).toEqual([0, 50])
    })

    it('pushes colliding nodes apart around their mean and keeps the order', () => {
      expect(fitColumn([10, 10], [1, 1], [0, 20], 100, false)).toEqual([0, 20])
    })

    it('clamps into the room', () => {
      expect(fitColumn([90, 95], [1, 1], [0, 20], 60, false)).toEqual([60, 80])
    })

    it('moves a rigid column as one block', () => {
      expect(fitColumn([0, 80], [1, 1], [0, 20], 100, true)).toEqual([30, 50])
    })
  })

  it('converts (u, w) to x/y in one place', () => {
    expect(toXY('horizontal', 1, 2)).toEqual({ x: 1, y: 2 })
    expect(toXY('vertical', 1, 2)).toEqual({ x: 2, y: 1 })
  })

  it('leaves exactly the requested gap between nodes when it fits', () => {
    const { plan, input: i } = input()
    const { nodes } = computeGeometry(plan, i)
    const a = nodes.get('A')
    const b = nodes.get('B')
    expect(b && a && b.y - (a.y + a.height)).toBeCloseTo(10, 9)
  })

  it('spends all of the axis on the tallest column', () => {
    const { plan, input: i } = input()
    const { nodes, k } = computeGeometry(plan, i)
    // sources: 10 + 10 units and one 10px gap in 100px
    expect(k).toBeCloseTo(4.5, 9)
    const a = nodes.get('A')
    const b = nodes.get('B')
    expect(a?.y).toBeCloseTo(0, 9)
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBeCloseTo(100, 9)
  })

  it('shrinks the gaps by one factor when they would take over the axis', () => {
    const { plan, input: i } = input({
      gaps: new Map(['A', 'B', 'C', 'D'].map((key) => [key, { after: 200, before: 200 }])),
    })
    const { nodes } = computeGeometry(plan, i)
    const a = nodes.get('A')
    const b = nodes.get('B')
    expect(b && a && b.y - (a.y + a.height)).toBeCloseTo(50, 9)
  })

  it('holds a node at its minimum size and centres its flows in it', () => {
    const { plan, input: i } = input({
      minSizes: new Map([
        ['A', 0],
        ['B', 60],
        ['C', 0],
        ['D', 0],
      ]),
    })
    const { nodes, flows } = computeGeometry(plan, i)
    expect(nodes.get('B')?.height).toBe(60)
    const link = plan.links.findIndex((l) => l.from.key === 'B')
    const bar = nodes.get('B')
    expect(flows[link].y).toBeGreaterThan(bar?.y ?? Number.POSITIVE_INFINITY)
  })

  it('leaves room for the labels outside the outermost columns', () => {
    const { plan, input: i } = input({ insets: { end: 20, start: 30 } })
    const { nodes } = computeGeometry(plan, i)
    expect(nodes.get('A')?.x).toBe(30)
    const c = nodes.get('C')
    expect(c && c.x + c.width).toBeLessThanOrEqual(180)
    const d = nodes.get('D')
    expect(d && d.x + d.width).toBeCloseTo(180, 9)
  })

  it('mirrors the axes for vertical charts', () => {
    const { plan, input: i } = input({ orientation: 'vertical' })
    const { nodes } = computeGeometry(plan, i)
    const a = nodes.get('A')
    expect(a?.y).toBe(0)
    expect(a?.height).toBe(10)
  })

  it('reserves the free space the order stage hints at, in flow units', () => {
    const plan = buildTopology(
      [
        { flow: 10, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'C' },
        { flow: 10, from: 'A', to: 'D' },
      ],
      {}
    )
    const free = plan.offsets.get('D') ?? 0
    const keys = [...plan.nodes.keys()]
    const { k } = computeGeometry(plan, {
      area: { bottom: 100, left: 0, right: 200, top: 0 },
      borderWidth: 0,
      gaps: new Map(keys.map((key) => [key, { after: 0, before: 0 }])),
      insets: { end: 0, start: 0 },
      minSizes: new Map(),
      nodeWidth: 10,
      orientation: 'horizontal',
      paddingMode: 'auto',
    })
    // the column of D holds its 10 units plus the free space above it
    expect(k).toBeCloseTo(100 / Math.max(20, 10 + free), 9)
  })
})
