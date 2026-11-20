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

  describe('lanes', () => {
    const ring = [
      { flow: 10, from: 'a', to: 'b' },
      { flow: 10, from: 'b', to: 'c' },
      { flow: 5, from: 'c', to: 'a' },
    ]

    function lay(
      data: Array<{ flow: number; from: string; to: string }>,
      width: number,
      height: number,
      over: Record<string, unknown> = {}
    ) {
      const plan = buildTopology(data, {})
      const keys = [...plan.nodes.keys()]
      const geometry = computeGeometry(plan, {
        area: { bottom: height, left: 0, right: width, top: 0 },
        borderWidth: 1,
        gaps: new Map(keys.map((key) => [key, { after: 10, before: 10 }])),
        insets: { end: 0, start: 0 },
        minSizes: new Map(),
        nodeWidth: 10,
        orientation: 'horizontal',
        paddingMode: 'auto',
        ...over,
      })
      return { geometry, plan }
    }

    it('routes the back flow along a lane after the content, inside the area', () => {
      const { geometry, plan } = lay(ring, 400, 300)
      const back = geometry.flows[plan.links.findIndex((l) => l.back)]
      expect(back.back).toBe(true)
      const content = Math.max(...[...geometry.nodes.values()].map((r) => r.y + r.height))
      expect(back.lane - back.height / 2).toBeGreaterThan(content)
      expect(back.lane + back.height / 2).toBeLessThanOrEqual(300)
      // the forward flows are not routed
      expect(geometry.flows.filter((f) => f.back)).toHaveLength(1)
    })

    it('solves the scale with the lanes, so the thickness of the lane is part of the budget', () => {
      const forward = lay(ring.slice(0, 2), 400, 300).geometry.k
      const looped = lay(ring, 400, 300).geometry.k
      expect(looped).toBeLessThan(forward)
    })

    it('limits the scale on a short column axis and centers what is drawn across', () => {
      const wide = lay(ring, 700, 300).geometry
      const narrow = lay(ring, 160, 300).geometry
      expect(narrow.k).toBeLessThan(wide.k)
      const nodes = [...narrow.nodes.values()]
      const top = Math.min(...nodes.map((r) => r.y))
      const back = narrow.flows.find((f) => f.back)
      const bottom = (back?.lane ?? 0) + (back?.height ?? 0) / 2
      expect(top).toBeGreaterThan(5)
      expect(300 - bottom).toBeGreaterThanOrEqual(top - 1)
    })

    it('keeps the turns, the nodes and the lane inside the area on a tiny chart', () => {
      for (const [width, height] of [
        [60, 40],
        [100, 100],
        [40, 200],
      ]) {
        const { geometry } = lay(ring, width, height)
        for (const r of geometry.nodes.values()) {
          expect(r.x).toBeGreaterThanOrEqual(0)
          expect(r.x + r.width).toBeLessThanOrEqual(width + 1e-6)
          expect(r.y + r.height).toBeLessThanOrEqual(height + 1e-6)
        }
        const back = geometry.flows.find((f) => f.back)
        expect((back?.lane ?? 0) + (back?.height ?? 0) / 2).toBeLessThanOrEqual(height + 1e-6)
        expect((back?.x2 ?? 0) - (back?.reach ?? 0) - (back?.height ?? 0)).toBeGreaterThanOrEqual(
          -1e-6
        )
      }
    })

    it('never draws a lane thinner than the minimum while there is room', () => {
      const data = [
        { flow: 1000, from: 'a', to: 'b' },
        { flow: 1000, from: 'b', to: 'c' },
        { flow: 0.001, from: 'c', to: 'a' },
      ]
      const { geometry } = lay(data, 400, 300)
      const back = geometry.flows.find((f) => f.back)
      expect(back?.height).toBeGreaterThanOrEqual(1)
    })

    it('draws nothing for an empty back flow', () => {
      const { geometry } = lay([...ring.slice(0, 2), { flow: 0, from: 'c', to: 'a' }], 400, 300)
      const back = geometry.flows.find((f) => f.back)
      expect(back?.height).toBe(0)
    })

    it('mirrors the routes for vertical charts', () => {
      const { geometry } = lay(ring, 300, 400, { orientation: 'vertical' })
      const back = geometry.flows.find((f) => f.back)
      expect(back?.width).toBeGreaterThan(0)
      expect(back?.height).toBe(0)
      // the lane is on the cross axis, which is x
      const content = Math.max(...[...geometry.nodes.values()].map((r) => r.x + r.width))
      expect(back?.lane).toBeGreaterThan(content)
    })

    it('gives the turns of an outer lane more reach', () => {
      const nested = [
        { flow: 12, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'C' },
        { flow: 8, from: 'C', to: 'D' },
        { flow: 5, from: 'D', to: 'C' },
        { flow: 2, from: 'D', to: 'A' },
      ]
      const { geometry, plan } = lay(nested, 600, 400)
      const inner = geometry.flows[plan.links.findIndex((l) => l.lane === 0)]
      const outer = geometry.flows[plan.links.findIndex((l) => l.lane === 1)]
      expect(outer.reach).toBeGreaterThan(inner.reach)
      expect(outer.lane).toBeGreaterThan(inner.lane)
    })

    it('leaves a chart without back flows exactly as it was', () => {
      const { geometry } = lay(ring.slice(0, 2), 400, 300)
      const xs = [...geometry.nodes.values()].map((r) => r.x).sort((a, b) => a - b)
      // evenly spaced between the outline of the first and the last node
      expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 9)
      expect(xs[0]).toBe(1)
      expect(xs[2] + 10).toBe(399)
    })
  })
})
