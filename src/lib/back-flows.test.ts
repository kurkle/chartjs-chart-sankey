import type { SankeyDataPoint } from '../types.js'

import {
  BACK_FLOW_CORNER,
  BACK_FLOW_MAX_LANES,
  BACK_FLOW_MIN_RUN,
  BACK_FLOW_SELF_CORNER,
  backFlowBounds,
  backFlowClearance,
  backFlowLength,
  backFlowParts,
  backFlowPath,
  columnSpace,
  fitPixelsPerUnit,
  isBackFlow,
  isOnBackFlow,
  laneCenter,
  laneReach,
  planBackFlows,
  reserveBackFlowSpace,
} from './back-flows.js'
import { buildNodesFromData } from './core.js'
import { calculateX, calculateY, forwardLinks, layout } from './layout.js'

function columns(data: SankeyDataPoint[]) {
  const nodes = buildNodesFromData(data, {})
  const maxX = calculateX(nodes, data, 'edge')
  return { maxX, nodes }
}

const recycle: SankeyDataPoint[] = [
  { flow: 60, from: 'Raw', to: 'Factory' },
  { flow: 70, from: 'Factory', to: 'Product' },
  { flow: 10, from: 'Factory', to: 'Waste' },
  { flow: 70, from: 'Product', to: 'Use' },
  { flow: 50, from: 'Use', to: 'Landfill' },
  { flow: 20, from: 'Use', to: 'Factory' },
]

describe('lib/back-flows', () => {
  describe('isBackFlow', () => {
    it('is true when the target column is not after the source column', () => {
      expect(isBackFlow({ x: 2 }, { x: 0 })).toBe(true)
      expect(isBackFlow({ x: 1 }, { x: 1 })).toBe(true)
      expect(isBackFlow({ x: 1 }, { x: 2 })).toBe(false)
    })
  })

  describe('planBackFlows', () => {
    it('finds nothing in an acyclic chart', () => {
      const data = [
        { flow: 1, from: 'a', to: 'b' },
        { flow: 1, from: 'b', to: 'c' },
      ]
      expect(planBackFlows(data, columns(data).nodes)).toEqual([])
    })

    it('finds the flow that returns to an earlier column', () => {
      const lanes = planBackFlows(recycle, columns(recycle).nodes)
      expect(lanes).toEqual([
        {
          before: 0,
          clear: BACK_FLOW_CORNER,
          flow: 20,
          from: 3,
          index: 5,
          lift: 0,
          offset: 14,
          rank: 0,
          thickness: 20,
          to: 1,
        },
      ])
    })

    it('finds the closing flow of a ring', () => {
      const data = [
        { flow: 10, from: 'a', to: 'b' },
        { flow: 10, from: 'b', to: 'c' },
        { flow: 10, from: 'c', to: 'a' },
      ]
      const lanes = planBackFlows(data, columns(data).nodes)
      expect(lanes.map((l) => [l.index, l.from, l.to])).toEqual([[2, 2, 0]])
    })

    it('treats a flow to the same node as a back flow', () => {
      const data = [
        { flow: 20, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'B' },
        { flow: 20, from: 'B', to: 'C' },
      ]
      const lanes = planBackFlows(data, columns(data).nodes)
      expect(lanes.map((l) => [l.index, l.from, l.to])).toEqual([[1, 1, 1]])
    })

    it('puts the shortest loop innermost, equal loops in data order', () => {
      const data: SankeyDataPoint[] = [
        { flow: 50, from: 'a', to: 'b' },
        { flow: 50, from: 'b', to: 'c' },
        { flow: 50, from: 'c', to: 'd' },
        { flow: 5, from: 'd', to: 'a' }, // spans 3 columns
        { flow: 7, from: 'c', to: 'b' }, // spans 1 column
        { flow: 9, from: 'd', to: 'c' }, // spans 1 column
      ]
      const lanes = planBackFlows(data, columns(data).nodes)
      expect(lanes.map((l) => [l.index, l.rank])).toEqual([
        [4, 0],
        [5, 1],
        [3, 2],
      ])
      expect(lanes.map((l) => l.before)).toEqual([0, 7, 16])
    })

    it('lets loops that are a column apart share a lane', () => {
      const data: SankeyDataPoint[] = [
        { flow: 50, from: 'a', to: 'b' },
        { flow: 50, from: 'b', to: 'c' },
        { flow: 50, from: 'c', to: 'd' },
        { flow: 50, from: 'd', to: 'e' },
        { flow: 50, from: 'e', to: 'f' },
        { flow: 4, from: 'b', to: 'a' }, // columns 0-1
        { flow: 6, from: 'f', to: 'e' }, // columns 4-5
        { flow: 3, from: 'c', to: 'b' }, // columns 1-2: overlaps the first
      ]
      const lanes = planBackFlows(data, columns(data).nodes)
      const byIndex = new Map(lanes.map((l) => [l.index, l]))
      expect(byIndex.get(5)?.rank).toBe(0)
      expect(byIndex.get(6)?.rank).toBe(0)
      expect(byIndex.get(7)?.rank).toBe(1)
      // a shared lane is as thick as its thickest flow
      expect(byIndex.get(5)?.thickness).toBe(6)
      expect(byIndex.get(7)?.before).toBe(6)
    })

    it('routes nothing when the loops would need more than the allowed lanes', () => {
      // a chain where every node returns to the first one
      const chain: SankeyDataPoint[] = []
      const keys = Array.from({ length: BACK_FLOW_MAX_LANES + 3 }, (_, i) => `n${i}`)
      for (let i = 1; i < keys.length; i++) {
        chain.push({ flow: 10, from: keys[i - 1], to: keys[i] })
      }
      // all of these loops start from the first column, so they overlap each other
      for (let i = 1; i < keys.length; i++) {
        chain.push({ flow: 1, from: keys[i], to: keys[0] })
      }
      const { nodes } = columns(chain)
      expect(planBackFlows(chain, nodes)).toEqual([])
      // ... while the same chart with the limit's worth of loops is routed
      const fewer = chain.slice(0, keys.length - 1 + BACK_FLOW_MAX_LANES)
      expect(planBackFlows(fewer, columns(fewer).nodes)).toHaveLength(BACK_FLOW_MAX_LANES)
    })

    it('ignores empty flows', () => {
      const data = [
        { flow: 1, from: 'a', to: 'b' },
        { flow: 0, from: 'b', to: 'a' },
      ]
      expect(planBackFlows(data, columns(data).nodes)).toEqual([])
    })
  })

  describe('reserveBackFlowSpace', () => {
    it('reserves nothing without back flows', () => {
      expect(reserveBackFlowSpace([], 100, 300)).toBe(0)
    })

    it('reserves the lane thickness plus the gaps, which are in pixels', () => {
      const lanes = planBackFlows(recycle, columns(recycle).nodes)
      const content = 100
      const axis = 300
      const reserve = reserveBackFlowSpace(lanes, content, axis)
      // gaps: first gap + end gap = 18px; a value unit is (content + reserve) / axis pixels
      const pixelsOfGaps = 18 * ((content + reserve) / axis)
      expect(reserve).toBeCloseTo(20 + pixelsOfGaps, 8)
    })

    it('grows with every extra lane', () => {
      const lanes = planBackFlows(recycle, columns(recycle).nodes)
      const more = [...lanes, { ...lanes[0], before: 20, rank: 1 }]
      expect(reserveBackFlowSpace(more, 100, 300)).toBeGreaterThan(
        reserveBackFlowSpace(lanes, 100, 300) + 20
      )
    })
  })

  describe('layout', () => {
    const options = {
      height: 300,
      modeX: 'edge' as const,
      nodePadding: new Map(),
      nodePaddingMode: 'auto' as const,
      priority: false,
    }

    it('reports no back flows for an acyclic chart, leaving the layout alone', () => {
      const data = [
        { flow: 10, from: 'a', to: 'b' },
        { flow: 5, from: 'a', to: 'c' },
      ]
      const result = layout(buildNodesFromData(data, {}), data, options)
      expect(result.backFlows.lanes).toEqual([])
      expect(result.backFlows.reserve).toBe(0)
    })

    it('reports the lanes and the room for them after the content', () => {
      const nodes = buildNodesFromData(recycle, {})
      const result = layout(nodes, recycle, options)
      expect(result.backFlows.lanes).toHaveLength(1)
      expect(result.backFlows.content).toBe(result.maxY)
      expect(result.backFlows.reserve).toBeGreaterThan(20)
    })

    it('places the back flow after the forward flows in the source and the target node', () => {
      const nodes = buildNodesFromData(recycle, {})
      layout(nodes, recycle, options)
      const use = nodes.get('Use')
      const factory = nodes.get('Factory')
      // Use -> Landfill (forward, 50) first, then the back flow (20)
      expect(use?.to.map((f) => [f.key, f.addY])).toEqual([
        ['Landfill', 0],
        ['Factory', 50],
      ])
      // Raw -> Factory (forward, 60) first, then the back flow
      expect(factory?.from.map((f) => [f.key, f.addY])).toEqual([
        ['Raw', 0],
        ['Use', 60],
      ])
    })

    it('orders several back flows of a node outermost lane first', () => {
      const data: SankeyDataPoint[] = [
        { flow: 50, from: 'a', to: 'b' },
        { flow: 50, from: 'b', to: 'c' },
        { flow: 50, from: 'c', to: 'd' },
        { flow: 40, from: 'd', to: 'out' },
        { flow: 5, from: 'd', to: 'a' }, // long loop: outer lane
        { flow: 7, from: 'd', to: 'c' }, // short loop: inner lane
      ]
      const nodes = buildNodesFromData(data, {})
      layout(nodes, data, options)
      const d = nodes.get('d')
      expect(d?.to.map((f) => f.key)).toEqual(['out', 'a', 'c'])
      expect(d?.to.map((f) => f.addY)).toEqual([0, 40, 45])
    })
  })

  describe('node placement', () => {
    const options = {
      height: 300,
      modeX: 'edge' as const,
      nodePadding: new Map(),
      nodePaddingMode: 'auto' as const,
      priority: false,
    }
    const twoLoops: SankeyDataPoint[] = [
      { flow: 50, from: 'Feed', to: 'Mix' },
      { flow: 60, from: 'Mix', to: 'Reactor' },
      { flow: 70, from: 'Reactor', to: 'Separator' },
      { flow: 40, from: 'Separator', to: 'Product' },
      { flow: 20, from: 'Separator', to: 'Reactor' },
      { flow: 10, from: 'Separator', to: 'Mix' },
    ]

    it('leaves the routed flows out of the links the placement follows', () => {
      const { nodes } = columns(twoLoops)
      const lanes = planBackFlows(twoLoops, nodes)
      const links = forwardLinks([...nodes.values()], lanes)
      const separator = nodes.get('Separator')
      const reactor = nodes.get('Reactor')
      expect(separator && links(separator).to.map((f) => f.key)).toEqual(['Product'])
      expect(reactor && links(reactor).to.map((f) => f.key)).toEqual(['Separator'])
      // the nodes themselves keep every flow, as they all need room at the node
      expect(separator?.to).toHaveLength(3)
    })

    it('hands out the node itself when it has no routed flow', () => {
      const { nodes } = columns(twoLoops)
      const links = forwardLinks([...nodes.values()], planBackFlows(twoLoops, nodes))
      const feed = nodes.get('Feed')
      expect(feed && links(feed)).toBe(feed)
    })

    it('follows every flow when none is routed', () => {
      const { nodes } = columns(twoLoops)
      const links = forwardLinks([...nodes.values()], [])
      const separator = nodes.get('Separator')
      expect(separator && links(separator)).toBe(separator)
    })

    it('does not stack the ends of a back flow as if they were neighbours', () => {
      const nodes = buildNodesFromData(twoLoops, {})
      layout(nodes, twoLoops, options)
      const ys = ['Feed', 'Mix', 'Reactor', 'Separator', 'Product'].map((k) => nodes.get(k)?.y)
      // a straight spine along the top, with the loops below it
      expect(ys).toEqual([0, 0, 0, 0, 0])
    })

    it('places the chart as before when the back flows are not routed', () => {
      const chain: SankeyDataPoint[] = []
      const keys = Array.from({ length: BACK_FLOW_MAX_LANES + 3 }, (_, i) => `n${i}`)
      for (let i = 1; i < keys.length; i++) chain.push({ flow: 10, from: keys[i - 1], to: keys[i] })
      for (let i = 1; i < keys.length; i++) chain.push({ flow: 1, from: keys[i], to: keys[0] })
      const nodes = buildNodesFromData(chain, {})
      const result = layout(nodes, chain, options)
      expect(result.backFlows.lanes).toEqual([])
      const plain = buildNodesFromData(chain, {})
      calculateY([...plain.values()], calculateX(plain, chain, 'edge'))
      expect([...nodes.values()].map((n) => n.y)).toEqual([...plain.values()].map((n) => n.y))
    })
  })

  describe('room on the column axis in the layout', () => {
    const ring: SankeyDataPoint[] = [
      { flow: 10, from: 'a', to: 'b' },
      { flow: 10, from: 'b', to: 'c' },
      { flow: 10, from: 'c', to: 'a' },
    ]
    const options = {
      height: 700,
      modeX: 'edge' as const,
      nodePadding: new Map(),
      nodePaddingMode: 'auto' as const,
      priority: false,
    }
    const axis = { borderSpace: 1, length: 5000, nodeWidth: 10, padding: 10 }

    function run(columnAxis?: typeof axis & { labelRoom?: () => number }) {
      const nodes = buildNodesFromData(ring, {})
      const result = layout(nodes, ring, { ...options, columnAxis })
      const units = result.maxY + result.backFlows.reserve
      return { ...result, pixelsPerUnit: options.height / units }
    }

    it('lets the cross axis be filled when the column axis is long', () => {
      expect(run(axis).pixelsPerUnit).toBeCloseTo(run().pixelsPerUnit, 8)
    })

    it('limits the unit size on a short column axis, so the content leaves room', () => {
      const long = run(axis)
      const short = run({ ...axis, length: 400 })
      expect(short.backFlows.lanes).toHaveLength(1)
      expect(short.pixelsPerUnit).toBeLessThan(long.pixelsPerUnit)
      const lane = short.backFlows.lanes[0]
      const { lead, padding, spacing } = columnSpace([lane], short.maxX, short.pixelsPerUnit, {
        ...axis,
        labelAfter: 0,
        labelBefore: 0,
      })
      // the columns, turns and leads together use the column axis, and no more
      expect(lead + padding + short.maxX * spacing).toBeLessThanOrEqual(400 + 1e-6)
      expect(lead + padding + short.maxX * spacing).toBeGreaterThan(399)
    })

    it('takes the labels outside the end columns from the room', () => {
      const without = run({ ...axis, length: 400 })
      const labelled = run({ ...axis, labelRoom: () => 40, length: 400 })
      expect(labelled.pixelsPerUnit).toBeLessThan(without.pixelsPerUnit)
      expect(labelled.backFlows.labelBefore).toBe(40)
      expect(labelled.backFlows.labelAfter).toBe(40)
    })

    it('leaves the back flows as plain curves when even hair thin bands do not fit', () => {
      const result = run({ ...axis, length: 40 })
      expect(result.backFlows.lanes).toEqual([])
      expect(result.backFlows.reserve).toBe(0)
    })
  })

  describe('geometry', () => {
    const shape = { c1: 50, c2: 60, clear: 6, lane: 200, reach: 10, t: 20, u1: 300, u2: 100 }

    it('routes stub, turn, lane, turn, stub', () => {
      const { points, radius } = backFlowPath(shape)
      expect(radius).toBe(16) // half the thickness plus the corner
      expect(points).toEqual([
        { u: 300, w: 50 },
        { u: 326, w: 50 },
        { u: 326, w: 200 },
        { u: 74, w: 200 },
        { u: 74, w: 60 },
        { u: 100, w: 60 },
      ])
    })

    it('shrinks the turns when there is not enough room across', () => {
      const { radius } = backFlowPath({ ...shape, lane: 70 })
      expect(radius).toBe(5)
    })

    it('measures the length of the center line with rounded turns', () => {
      const path = backFlowPath(shape)
      const straight = 26 + 150 + 252 + 140 + 26
      const r = path.radius
      expect(backFlowLength(path)).toBeCloseTo(straight - 8 * r + 2 * Math.PI * r, 8)
    })

    it('builds the center line from five straight runs and four quarter turns', () => {
      const parts = backFlowParts(backFlowPath(shape))
      expect(parts.map((part) => part.type)).toEqual([
        'line',
        'arc',
        'line',
        'arc',
        'line',
        'arc',
        'line',
        'arc',
        'line',
      ])
    })

    it('leaves out runs without length', () => {
      // turns start right at the node edge when the loop has no reach and no stub
      const parts = backFlowParts(backFlowPath({ ...shape, reach: 0 }))
      expect(parts.filter((part) => part.type === 'arc')).toHaveLength(4)
      expect(parts.filter((part) => part.type === 'line')).toHaveLength(3)
    })

    it('hits the band and nothing around it', () => {
      expect(isOnBackFlow({ u: 200, w: 200 }, shape)).toBe(true) // lane
      expect(isOnBackFlow({ u: 200, w: 209 }, shape)).toBe(true)
      expect(isOnBackFlow({ u: 200, w: 211 }, shape)).toBe(false)
      expect(isOnBackFlow({ u: 326, w: 120 }, shape)).toBe(true) // right leg
      expect(isOnBackFlow({ u: 74, w: 120 }, shape)).toBe(true) // left leg
      expect(isOnBackFlow({ u: 200, w: 120 }, shape)).toBe(false) // inside the loop
      expect(isOnBackFlow({ u: 310, w: 50 }, shape)).toBe(true) // source stub
      expect(isOnBackFlow({ u: 290, w: 50 }, shape)).toBe(false) // before the source edge
      expect(isOnBackFlow({ u: 110, w: 60 }, shape)).toBe(false) // after the target edge
      expect(isOnBackFlow({ u: 340, w: 195 }, shape)).toBe(false) // outside of a turn
      expect(isOnBackFlow({ u: 322, w: 190 }, shape)).toBe(true) // on a turn
    })

    it('has butt ends even when the band is much thicker than the turns are long', () => {
      const thick = { c1: 80, c2: 80, clear: 6, lane: 250, reach: 0, t: 158, u1: 440, u2: 170 }
      expect(isOnBackFlow({ u: 420, w: 18 }, thick)).toBe(false) // behind the source edge
      expect(isOnBackFlow({ u: 190, w: 30 }, thick)).toBe(false) // behind the target edge
      expect(isOnBackFlow({ u: 520, w: 80 }, thick)).toBe(true)
      expect(isOnBackFlow({ u: 300, w: 250 }, thick)).toBe(true)
    })

    it('has bounds that contain the band', () => {
      expect(backFlowBounds(shape)).toEqual({ uMax: 336, uMin: 64, wMax: 210, wMin: 40 })
    })

    it('keeps the turns of an outer lane further out', () => {
      const inner = backFlowPath({ ...shape, reach: 0 }).points
      const outer = backFlowPath({ ...shape, reach: 30 }).points
      expect(outer[1].u - inner[1].u).toBe(30)
      expect(inner[3].u - outer[3].u).toBe(30)
    })
  })

  describe('lane geometry', () => {
    const lane = {
      before: 10,
      clear: 6,
      flow: 5,
      from: 3,
      index: 0,
      lift: 12,
      offset: 26,
      rank: 2,
      thickness: 5,
      to: 1,
    }

    it('reaches by the room of the inner lanes', () => {
      expect(laneReach(lane, 2)).toBe(10 * 2 + 12)
    })

    it('puts the lane after the content, the inner lanes and the gaps', () => {
      expect(laneCenter(lane, 100, 2)).toBe(100 + 26 + 10 * 2 + (5 * 2) / 2)
    })

    it('gives the loop of a node to itself a wider inner radius', () => {
      expect(backFlowClearance(false)).toBe(BACK_FLOW_CORNER)
      expect(backFlowClearance(true)).toBe(BACK_FLOW_SELF_CORNER)
      expect(BACK_FLOW_SELF_CORNER).toBeGreaterThan(BACK_FLOW_CORNER)
    })

    it('keeps the hole of a loop to a node itself open to its inner radius', () => {
      const data = [
        { flow: 20, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'B' },
      ]
      const [self] = planBackFlows(data, columns(data).nodes)
      expect(self.clear).toBe(BACK_FLOW_SELF_CORNER)
      // a turn needs twice its inner radius across to keep it
      expect(self.offset).toBeGreaterThanOrEqual(2 * BACK_FLOW_SELF_CORNER)
    })

    it('keeps an outer lane clear of the hole of the self flow inside it', () => {
      const data: SankeyDataPoint[] = [
        { flow: 50, from: 'a', to: 'b' },
        { flow: 50, from: 'b', to: 'c' },
        { flow: 5, from: 'b', to: 'b' },
        { flow: 4, from: 'c', to: 'a' },
      ]
      const lanes = planBackFlows(data, columns(data).nodes)
      const self = lanes.find((l) => l.index === 2)
      const outer = lanes.find((l) => l.index === 3)
      expect(self?.rank).toBe(0)
      expect(outer?.rank).toBe(1)
      // the turn of the outer lane starts beyond the outer edge of the inner one
      const edge = (self?.flow ?? 0) * 2 + (self?.clear ?? 0)
      expect((outer?.lift ?? 0) + (outer?.before ?? 0) * 2 + (outer?.clear ?? 0)).toBeGreaterThan(
        edge
      )
    })
  })

  describe('room on the column axis', () => {
    const [lane] = planBackFlows(recycle, columns(recycle).nodes) // columns 3 -> 1, 4 columns after 0
    const axis = {
      borderSpace: 1,
      labelAfter: 0,
      labelBefore: 0,
      nodeWidth: 10,
      padding: 13,
    }

    it('needs no lead when no turn comes before the first column', () => {
      expect(columnSpace([lane], 4, 2, axis).lead).toBe(0)
    })

    it('needs a lead for a flow into the first column, and the labels outside it', () => {
      const into = { ...lane, to: 0 }
      const turn = 5 * 2 + BACK_FLOW_CORNER + 2 // flow, inner radius, edge gap
      expect(columnSpace([{ ...into, flow: 5 }], 4, 2, axis).lead).toBe(turn + 1)
      expect(columnSpace([{ ...into, flow: 5 }], 4, 2, { ...axis, labelBefore: 30 }).lead).toBe(
        turn + 1 + 30
      )
    })

    it('needs padding after the last column only for a flow leaving it', () => {
      expect(columnSpace([lane], 4, 2, axis).padding).toBe(13)
      const leaving = columnSpace([{ ...lane, flow: 5, from: 4 }], 4, 2, axis).padding
      expect(leaving).toBe(10 + 1 + (5 * 2 + BACK_FLOW_CORNER + 2))
    })

    it('keeps the turns of both ends of a gap, and at least a minimum run, between columns', () => {
      const leaves = { ...lane, flow: 5, from: 1, to: 0 }
      const enters = { ...lane, flow: 5, from: 4, to: 2 }
      const turn = 5 * 2 + BACK_FLOW_CORNER + 2
      const { spacing } = columnSpace([leaves, enters], 4, 2, axis)
      // column 1 leaves and column 2 is entered, in the same gap
      expect(spacing).toBe(10 + 2 + Math.max(BACK_FLOW_MIN_RUN, 2 * turn))
      // a small turn leaves the minimum run
      expect(columnSpace([{ ...lane, flow: 1 }], 4, 2, axis).spacing).toBe(
        10 + 2 + BACK_FLOW_MIN_RUN
      )
    })

    it('leaves the unit size alone when everything fits', () => {
      expect(fitPixelsPerUnit([lane], 4, 3, axis, 5000)).toBe(3)
    })

    it('shrinks the unit size until the turns and the columns fit', () => {
      const fitted = fitPixelsPerUnit([{ ...lane, from: 4, to: 0 }], 4, 30, axis, 300)
      expect(fitted).toBeGreaterThan(0)
      expect(fitted).toBeLessThan(30)
      const { lead, padding, spacing } = columnSpace([{ ...lane, from: 4, to: 0 }], 4, fitted, axis)
      expect(lead + padding + 4 * spacing).toBeCloseTo(300, 4)
    })

    it('gives up when not even hair thin bands fit', () => {
      expect(fitPixelsPerUnit([lane], 4, 30, axis, 20)).toBe(0)
    })
  })
})
