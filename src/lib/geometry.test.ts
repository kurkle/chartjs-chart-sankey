import type { Route } from '../types.js'
import type { Geometry, Rect } from './geometry.js'
import type { Plan, PlanSlot } from './topology.js'

import { END_GAP } from './constants.js'
import { computeGeometry, fitColumn } from './geometry.js'
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

/** The lane route of a back flow. */
const laneOf = (flow?: { route: Route }) => {
  const { points, radius = 0 } = (flow as { route: Route }).route
  return {
    lane: points[2].w,
    reach1: points[1].u - points[0].u - radius,
    reach2: points[5].u - points[4].u - radius,
  }
}

describe('lib/geometry', () => {
  describe('the scale', () => {
    const scale = (minSizes: Record<string, number> = {}) => {
      const { input: base, plan } = input()
      const minSizesMap = new Map([...base.minSizes.keys()].map((key) => [key, minSizes[key] ?? 0]))
      return computeGeometry(plan, { ...base, minSizes: minSizesMap }).k
    }

    it('divides what the gaps leave of the cross axis by the units of the fullest column', () => {
      // 20 units and one gap of 10 in 100 pixels
      expect(scale()).toBe(4.5)
    })

    it('holds a node at its minimum size and scales the others into what is left', () => {
      // D (4 units) is held at 22 pixels: 16 units get 100 - 10 - 22
      expect(scale({ D: 22 })).toBeCloseTo(4.25, 9)
    })

    it('does not let a column whose minimum sizes cannot fit hold the others back', () => {
      expect(scale({ C: 60, D: 60 })).toBe(4.5)
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

  it('converts (u, w) to x/y in one place', () => {})

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

  describe('flows that skip columns', () => {
    // A -> D skips the columns of B and C, where it has a waypoint each
    const skipping = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 2, from: 'B', to: 'C' },
      { flow: 10, from: 'C', to: 'D' },
      { flow: 5, from: 'A', to: 'D' },
      { flow: 8, from: 'X', to: 'C' },
    ]
    /** Where the flow from A to D runs across its two waypoints. */
    const levels = (paddingMode: 'auto' | 'even') => {
      const plan = buildTopology(skipping, {})
      const { input: base } = input({
        area: { bottom: 200, left: 0, right: 400, top: 0 },
        gaps: new Map([...plan.nodes.keys()].map((key) => [key, { after: 10, before: 10 }])),
        minSizes: new Map(),
        paddingMode,
      })
      const { points } = computeGeometry(plan, base).flows[3].route
      expect(points).toHaveLength(6)
      // a run across a waypoint is level in itself
      expect(points[1].w).toBe(points[2].w)
      expect(points[3].w).toBe(points[4].w)
      return [points[1].w, points[3].w]
    }

    it('runs level from one waypoint to the next', () => {
      const [first, second] = levels('auto')
      expect(first).toBeCloseTo(second, 8)
    })

    it('does not hold the waypoints level when the columns move as blocks', () => {
      const [first, second] = levels('even')
      expect(Math.abs(first - second)).toBeGreaterThan(10)
    })
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
      expect(laneOf(back).lane - back.height / 2).toBeGreaterThan(content)
      expect(laneOf(back).lane + back.height / 2).toBeLessThanOrEqual(300)
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
      const bottom = (laneOf(back).lane ?? 0) + (back?.height ?? 0) / 2
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
        expect((laneOf(back).lane ?? 0) + (back?.height ?? 0) / 2).toBeLessThanOrEqual(
          height + 1e-6
        )
        expect(
          (back?.x2 ?? 0) - (laneOf(back).reach2 ?? 0) - (back?.height ?? 0)
        ).toBeGreaterThanOrEqual(-1e-6)
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
      expect(laneOf(back).lane).toBeGreaterThan(content)
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
      const inner = geometry.flows[plan.links.findIndex((l) => l.rank === 0)]
      const outer = geometry.flows[plan.links.findIndex((l) => l.rank === 1)]
      expect(laneOf(outer).reach1).toBeGreaterThan(laneOf(inner).reach1)
      expect(laneOf(outer).lane).toBeGreaterThan(laneOf(inner).lane)
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

  describe('the alignment', () => {
    type Data = Array<{ flow: number; from: string; to: string }>
    type Align = 'auto' | 'start' | 'end' | 'edges'
    interface Options {
      backFlows?: { side: 'start' | 'end' }
      borderWidth?: number
      gaps?: Record<string, { after: number; before: number }>
      height?: number
      minSizes?: Record<string, number>
      orientation?: 'horizontal' | 'vertical'
      paddingMode?: 'auto' | 'even'
      width?: number
    }
    /** Where a slot starts and ends on the cross axis. */
    interface Span {
      bottom: number
      key: string
      node: boolean
      top: number
    }

    /** Where a slot is on the cross axis; a waypoint is where its flow enters it. */
    function spanOf(plan: Plan, geometry: Geometry, slot: PlanSlot, vertical: boolean): Span {
      if (slot.node) {
        const r = geometry.nodes.get(slot.key) as Rect
        const [top, size] = vertical ? [r.x, r.width] : [r.y, r.height]
        return { bottom: top + size, key: slot.key, node: true, top }
      }
      const link = plan.links[Number(slot.key.split('@')[0])]
      const j = slot.column - link.path[0].column
      const top = geometry.flows[link.index].route.points[2 * j - 1].w
      return { bottom: top + geometry.k * link.flow, key: slot.key, node: false, top }
    }

    /** The edges of the lane of the back flow: the one next to the content and the one away from it. */
    function laneEdges(geometry: Geometry, side: 'start' | 'end') {
      const back = geometry.flows.find((flow) => flow.back)
      if (!back) return undefined
      const away = side === 'start' ? -1 : 1
      const { lane } = laneOf(back)
      return { inner: lane - (away * back.route.t) / 2, outer: lane + (away * back.route.t) / 2 }
    }

    /** Lays `data` out with `align`, with gaps of 10 unless `gaps` says otherwise. */
    function place(data: Data, align: Align | undefined, options: Options = {}) {
      const { backFlows, height = 100, orientation = 'horizontal', width = 200 } = options
      const plan = buildTopology(data, backFlows ? { backFlows } : {})
      const keys = [...plan.nodes.keys()]
      const geometry = computeGeometry(plan, {
        area: { bottom: height, left: 0, right: width, top: 0 },
        borderWidth: options.borderWidth ?? 0,
        gaps: new Map(keys.map((key) => [key, options.gaps?.[key] ?? { after: 10, before: 10 }])),
        insets: { end: 0, start: 0 },
        minSizes: new Map(keys.map((key) => [key, options.minSizes?.[key] ?? 0])),
        nodeWidth: 10,
        orientation,
        paddingMode: options.paddingMode ?? 'auto',
        ...(align && { align }),
      })
      const vertical = orientation === 'vertical'
      /** The slots of every column, in order, where they are on the cross axis. */
      const columns = plan.slots.map((column) =>
        column.map((slot) => spanOf(plan, geometry, slot, vertical))
      )
      const all = columns.flat()
      const lane = laneEdges(geometry, backFlows?.side ?? 'end')
      return {
        bottom: Math.max(...all.map((s) => s.bottom)),
        columns,
        geometry,
        lane,
        plan,
        top: Math.min(...all.map((s) => s.top)),
      }
    }
    /** The gaps between the neighbours of a column. */
    const gapsIn = (column: Span[]) => column.slice(1).map((s, i) => s.top - column[i].bottom)

    // three sources into two targets: the column of the targets has 10 pixels to spare
    const packing = [
      { flow: 10, from: 'A', to: 'X' },
      { flow: 5, from: 'B', to: 'X' },
      { flow: 5, from: 'C', to: 'Y' },
    ]

    it('packs every column at the start with exactly the requested gaps with start', () => {
      const { columns } = place(packing, 'start')
      expect(columns.map((column) => column.length)).toEqual([3, 2])
      for (const column of columns) {
        expect(column[0].top).toBeCloseTo(0, 9)
        for (const gap of gapsIn(column)) expect(gap).toBeCloseTo(10, 9)
      }
    })

    it('packs every column at the end with exactly the requested gaps with end', () => {
      const { columns } = place(packing, 'end')
      for (const column of columns) {
        expect((column.at(-1) as Span).bottom).toBeCloseTo(100, 9)
        for (const gap of gapsIn(column)) expect(gap).toBeCloseTo(10, 9)
      }
    })

    it('packs at the left edge of a vertical chart with start', () => {
      const { columns } = place(packing, 'start', {
        height: 200,
        orientation: 'vertical',
        width: 100,
      })
      for (const column of columns) {
        expect(column[0].top).toBeCloseTo(0, 9)
        for (const gap of gapsIn(column)) expect(gap).toBeCloseTo(10, 9)
      }
    })

    it('leaves the default placement as it was when the alignment is absent or auto', () => {
      const absent = place(packing, undefined).geometry
      const auto = place(packing, 'auto').geometry
      expect(auto).toEqual(absent)
      // the target with the most of the first sources is pulled to them, so its gaps are wider
      const { columns } = place(packing, undefined)
      expect(gapsIn(columns[1])[0]).toBeGreaterThan(10 + 1e-6)
    })

    describe('a drawing that does not fill the cross axis', () => {
      const ring = [
        { flow: 10, from: 'a', to: 'b' },
        { flow: 10, from: 'b', to: 'c' },
        { flow: 5, from: 'c', to: 'a' },
      ]
      // the column axis limits the scale, so the drawing is shorter than the cross axis
      const options = { borderWidth: 1, height: 1000, width: 400 }

      it('is not as tall as the axis', () => {
        const { top } = place(ring, 'auto', options)
        expect(top).toBeGreaterThan(100)
      })

      it('starts at the start edge with start', () => {
        const { top } = place(ring, 'start', options)
        expect(top).toBeCloseTo(0, 9)
      })

      it('ends at the end edge with end, with the usual gap after the lane', () => {
        const { lane, top } = place(ring, 'end', options)
        const outer = lane?.outer ?? 0
        expect(top).toBeGreaterThan(100)
        expect(1000 - outer).toBeGreaterThanOrEqual(END_GAP - 0.5)
        expect(1000 - outer).toBeLessThanOrEqual(END_GAP + 0.5)
      })

      it('is centred with edges', () => {
        const { lane, top } = place(ring, 'edges', options)
        const after = 1000 - (lane?.outer ?? 0) - END_GAP
        expect(top).toBeGreaterThan(100)
        expect(Math.abs(after - top)).toBeLessThanOrEqual(1)
      })
    })

    describe('a column whose minimum sizes do not fit', () => {
      // C (16 units of 4.5 pixels) and D (held at 60) take 142 pixels of 100 with their gap
      const minSizes = { C: 60, D: 60 }

      it('overflows past the end edge with start', () => {
        const { bottom, top } = place(flows, 'start', { minSizes })
        expect(top).toBeCloseTo(0, 9)
        expect(bottom).toBeCloseTo(142, 9)
      })

      it('overflows before the start edge with end', () => {
        const { bottom, top } = place(flows, 'end', { minSizes })
        expect(top).toBeCloseTo(-42, 9)
        expect(bottom).toBeCloseTo(100, 9)
      })
    })

    describe('edges', () => {
      // A is held taller than its flows, which then leave it 10 pixels from its top:
      // the first target is pulled away from the start edge
      const minSizes = { A: 55 }

      it('puts the first and the last slot of a column of two at the edges', () => {
        const { columns } = place(flows, 'edges', { minSizes })
        const [c, d] = columns[1]
        expect(c.top).toBeCloseTo(0, 9)
        expect(d.bottom).toBeCloseTo(100, 9)
      })

      it('puts the first and the last slot of a column of three at the edges, and keeps the gaps of the one between', () => {
        const three = [
          { flow: 10, from: 'A', to: 'C' },
          { flow: 2, from: 'B', to: 'C' },
          { flow: 4, from: 'B', to: 'D' },
          { flow: 4, from: 'B', to: 'E' },
        ]
        const { columns } = place(three, 'edges', { minSizes })
        expect(columns[1]).toHaveLength(3)
        expect(columns[1][0].top).toBeCloseTo(0, 9)
        expect(columns[1][2].bottom).toBeCloseTo(100, 9)
        for (const gap of gapsIn(columns[1])) expect(gap).toBeGreaterThanOrEqual(10 - 1e-9)
      })

      it('puts the only slot of a column at the start edge when its flows meet it in the first half', () => {
        const { columns } = place(
          [
            { flow: 4, from: 'A', to: 'X' },
            { flow: 2, from: 'B', to: 'X' },
          ],
          'edges'
        )
        expect(columns[1]).toHaveLength(1)
        expect(columns[1][0].top).toBeCloseTo(0, 9)
      })

      it('puts the only slot of a column at the end edge when its flows meet it in the second half', () => {
        const { columns } = place(
          [
            { flow: 2, from: 'A', to: 'X' },
            { flow: 4, from: 'B', to: 'X' },
          ],
          'edges'
        )
        expect(columns[1][0].bottom).toBeCloseTo(100, 9)
      })

      it('runs a flow along the start edge when the first slot of a column is its waypoint', () => {
        // A -> C skips the column of B; A is held taller than its flow
        const { columns } = place(
          [
            { flow: 4, from: 'A', to: 'C' },
            { flow: 10, from: 'X', to: 'B' },
            { flow: 10, from: 'B', to: 'C' },
          ],
          'edges',
          { gaps: { A: { after: 30, before: 10 } }, minSizes: { A: 40 } }
        )
        const [waypoint, b] = columns[1]
        expect(waypoint.node).toBe(false)
        expect(waypoint.top).toBeCloseTo(0, 9)
        expect(b.key).toBe('B')
        expect(b.bottom).toBeCloseTo(100, 9)
      })

      it('does not move a pinned node when it levels the flows that skip columns', () => {
        const skipping = [
          { flow: 10, from: 'A', to: 'B' },
          { flow: 2, from: 'B', to: 'C' },
          { flow: 10, from: 'C', to: 'D' },
          { flow: 5, from: 'A', to: 'D' },
          { flow: 8, from: 'X', to: 'C' },
        ]
        const { columns, geometry } = place(skipping, 'edges', { height: 200, width: 400 })
        // the flow from A to D is levelled across its two waypoints
        const { points } = geometry.flows[3].route
        expect(points[1].w).toBeCloseTo(points[3].w, 8)
        // the outermost slots of the columns of two or more that are nodes
        const shared = columns.filter((column) => column.length > 1)
        const firsts = shared.map((column) => column[0]).filter((span) => span.node)
        const lasts = shared.map((column) => column.at(-1) as Span).filter((span) => span.node)
        expect(firsts.length + lasts.length).toBeGreaterThan(0)
        for (const span of firsts) expect(span.top, span.key).toBeCloseTo(0, 9)
        for (const span of lasts) expect(span.bottom, span.key).toBeCloseTo(200, 9)
      })
    })

    describe('lanes', () => {
      // the back flow from c to b runs under the columns of b and c, not under a or d
      const chain = [
        { flow: 10, from: 'a', to: 'b' },
        { flow: 10, from: 'b', to: 'c' },
        { flow: 10, from: 'c', to: 'd' },
        { flow: 3, from: 'c', to: 'b' },
      ]
      // the column axis limits the scale, so there is room to spare across
      const after = { borderWidth: 1, height: 600, width: 200 }
      const before = { ...after, backFlows: { side: 'start' as const } }
      /** From the content of the columns under the lane to the lane. */
      const reach = ({ columns, lane }: ReturnType<typeof place>, side: 'start' | 'end') =>
        side === 'end'
          ? (lane?.inner ?? 0) - Math.max(columns[1][0].bottom, columns[2][0].bottom)
          : Math.min(columns[1][0].top, columns[2][0].top) - (lane?.inner ?? 0)

      it('keeps the lanes after the content right after it with start', () => {
        const auto = place(chain, 'auto', after)
        const start = place(chain, 'start', after)
        for (const column of start.columns) expect(column[0].top).toBeCloseTo(0, 9)
        expect(reach(start, 'end')).toBeCloseTo(reach(auto, 'end'), 9)
        expect(600 - (start.lane?.outer ?? 0)).toBeGreaterThan(100)
      })

      it('puts the lanes after the content at the end edge with end, and the columns beside them too', () => {
        const auto = place(chain, 'auto', after)
        const end = place(chain, 'end', after)
        const outer = end.lane?.outer ?? 0
        expect(600 - outer).toBeGreaterThanOrEqual(0)
        expect(600 - outer).toBeLessThanOrEqual(END_GAP)
        expect(reach(end, 'end')).toBeCloseTo(reach(auto, 'end'), 9)
        expect(end.columns[0][0].bottom).toBeCloseTo(600, 9)
        expect(end.columns[3][0].bottom).toBeCloseTo(600, 9)
      })

      it('puts the lanes before the content at the start edge with start, and the columns beside them too', () => {
        const auto = place(chain, 'auto', before)
        const start = place(chain, 'start', before)
        const outer = start.lane?.outer ?? 0
        expect(outer).toBeGreaterThanOrEqual(0)
        expect(outer).toBeLessThanOrEqual(END_GAP)
        expect(reach(start, 'start')).toBeCloseTo(reach(auto, 'start'), 9)
        expect(start.columns[0][0].top).toBeCloseTo(0, 9)
        expect(start.columns[3][0].top).toBeCloseTo(0, 9)
      })

      it('keeps the lanes before the content right before it with end', () => {
        const auto = place(chain, 'auto', before)
        const end = place(chain, 'end', before)
        for (const column of end.columns) {
          expect((column.at(-1) as Span).bottom).toBeCloseTo(600, 9)
        }
        expect(reach(end, 'start')).toBeCloseTo(reach(auto, 'start'), 9)
        expect(end.lane?.outer ?? 0).toBeGreaterThan(100)
      })
    })

    describe('flows that skip columns', () => {
      const skipping = [
        { flow: 10, from: 'A', to: 'B' },
        { flow: 2, from: 'B', to: 'C' },
        { flow: 10, from: 'C', to: 'D' },
        { flow: 5, from: 'A', to: 'D' },
        { flow: 8, from: 'X', to: 'C' },
      ]
      /** How far the flow from A to D runs from one level across its two waypoints. */
      const bend = (align: Align, paddingMode: 'auto' | 'even') => {
        const { points } = place(skipping, align, { height: 200, paddingMode, width: 400 }).geometry
          .flows[3].route
        return Math.abs(points[1].w - points[3].w)
      }

      it('levels them with start', () => {
        expect(bend('start', 'auto')).toBeCloseTo(0, 8)
      })

      it('levels them with start when the padding mode is even', () => {
        expect(bend('start', 'even')).toBeCloseTo(0, 8)
      })

      it('does not level them with auto when the padding mode is even', () => {
        expect(bend('auto', 'even')).toBeGreaterThan(10)
      })
    })
  })
})
