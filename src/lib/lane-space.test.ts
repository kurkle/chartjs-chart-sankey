import type { SankeyControllerDatasetBackFlowsOptions as SankeyBackFlows } from '../types.js'

import { END_GAP, FIRST_GAP, LANE_GAP, MIN_THICKNESS, SELF_CORNER } from './constants.js'
import { buildLoops, measureLoops, placeLoops } from './lane-space.js'
import { buildTopology } from './topology.js'

const ring = [
  { flow: 10, from: 'a', to: 'b' },
  { flow: 10, from: 'b', to: 'c' },
  { flow: 4, from: 'c', to: 'a' },
]

const nested = [
  { flow: 12, from: 'A', to: 'B' },
  { flow: 10, from: 'B', to: 'C' },
  { flow: 8, from: 'C', to: 'D' },
  { flow: 5, from: 'D', to: 'C' },
  { flow: 2, from: 'D', to: 'A' },
]

const chain = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 10, from: 'B', to: 'C' },
  { flow: 10, from: 'C', to: 'D' },
  { flow: 10, from: 'D', to: 'E' },
  { flow: 10, from: 'E', to: 'F' },
]

const recycling = [
  { flow: 60, from: 'Raw', to: 'Factory' },
  { flow: 70, from: 'Factory', to: 'Product' },
  { flow: 10, from: 'Factory', to: 'Waste' },
  { flow: 70, from: 'Product', to: 'Use' },
  { flow: 50, from: 'Use', to: 'Landfill' },
  { flow: 20, from: 'Use', to: 'Factory' },
  { flow: 8, from: 'Product', to: 'Factory' },
]

function lanes(data: typeof ring, k: number, factor = 1, backFlows?: SankeyBackFlows) {
  const plan = buildTopology(data, { backFlows })
  const loops = buildLoops(plan)
  return { loops, space: measureLoops(loops, plan.maxColumn + 1, k, factor) }
}

describe('lib/lane-space', () => {
  it('needs no room without back flows', () => {
    const { loops, space } = lanes([{ flow: 1, from: 'a', to: 'b' }], 5)
    expect(loops).toHaveLength(0)
    expect(space).toEqual({ depth: [0, 0], depthTop: [0, 0], into: [0, 0], out: [0, 0], run: 0 })
  })

  it('takes the thickness of a loop from the columns it passes, scaled', () => {
    // 4 units of thickness: 10 more pixels per unit
    expect(lanes(ring, 11).space.depth[1] - lanes(ring, 1).space.depth[1]).toBeCloseTo(40, 9)
    expect(lanes(ring, 1).space.depth).toEqual(new Array(3).fill(FIRST_GAP + 4 + END_GAP))
  })

  it('never lets a lane vanish, and shrinks the fixed pixels by the factor', () => {
    expect(lanes(ring, 0).loops[0].t).toBe(MIN_THICKNESS)
    expect(lanes(ring, 0, 0.25).loops[0].t).toBe(MIN_THICKNESS / 4)
    expect(lanes(ring, 0, 0.5).space.depth[0]).toBe(lanes(ring, 0).space.depth[0] / 2)
  })

  it('charges a loop only to the columns it runs under', () => {
    const { space } = lanes([...chain, { flow: 3, from: 'B', to: 'A' }], 1)
    expect(space.depth.map((depth) => depth > 0)).toEqual([true, true, false, false, false, false])
  })

  it('lets loops that do not overlap share a level', () => {
    const { loops } = lanes(
      [...chain, { flow: 3, from: 'B', to: 'A' }, { flow: 4, from: 'F', to: 'E' }],
      1
    )
    expect(loops.map((loop) => loop.below.length)).toEqual([0, 0])
    expect(loops.map((loop) => loop.level)).toEqual([FIRST_GAP, FIRST_GAP])
  })

  it('stacks overlapping loops: the outer one on the inner one', () => {
    const { loops, space } = lanes(nested, 10)
    const [inner, outer] = loops
    expect(outer.below).toEqual([inner])
    expect(outer.level).toBe(inner.level + inner.t + LANE_GAP)
    // the last column holds the turns of both loops, the outer one around the inner one
    const d = nested.find((link) => link.from === 'D' && link.to === 'C')
    const source = inner.link.from
    expect(d).toBeDefined()
    expect(outer.outAt.get(source)).toBe(inner.t + LANE_GAP)
    expect(space.out[3]).toBeGreaterThan(inner.t + outer.t)
    // the room of the loop under a loop is taken from the columns of the loop above too
    expect([...outer.reach].sort()).toEqual([0, 1, 2, 3])
    expect(space.depth[0]).toBe(outer.level + outer.t + END_GAP)
  })

  it('gives a flow to the node itself a wider inner radius', () => {
    const { loops, space } = lanes(
      [
        { flow: 5, from: 'A', to: 'B' },
        { flow: 2, from: 'B', to: 'B' },
      ],
      1
    )
    expect(loops[0].clear).toBe(SELF_CORNER)
    expect(loops[0].level).toBeGreaterThanOrEqual(2 * SELF_CORNER)
    expect(space.out[1]).toBeGreaterThan(SELF_CORNER)
  })

  it('starts a lane after the content of its own columns, and after the loops below it', () => {
    const { loops } = lanes(nested, 10)
    const [inner, outer] = loops
    // where the content of the four columns ends
    placeLoops(loops, [0, 0, 0, 0], [200, 40, 50, 60], 1)
    expect(inner.start).toBe(60 + FIRST_GAP)
    expect(outer.start).toBe(200 + FIRST_GAP)
    placeLoops(loops, [0, 0, 0, 0], [10, 40, 50, 60], 1)
    expect(outer.start).toBe(inner.start + inner.t + LANE_GAP)
  })

  describe('backFlows', () => {
    const members = (loop: { members: { from: { key: string } }[] }) =>
      loop.members.map((link) => link.from.key)

    it("shares a lane between the flows of one pair of nodes by default ('pair')", () => {
      const data = [...recycling, { flow: 3, from: 'Product', to: 'Factory' }]
      // Product -> Factory is listed twice, 8 and 3, the others have a pair each
      const { loops } = lanes(data, 1)
      expect(loops.map((loop) => loop.members.length).sort()).toEqual([1, 2])
      const pair = loops.find((loop) => loop.members.length === 2)
      expect(pair && members(pair)).toEqual(['Product', 'Product'])
    })

    it('keeps a lane for each flow with bundle false', () => {
      const { loops } = lanes(recycling, 1, 1, { bundle: false })
      expect(loops).toHaveLength(2)
      expect(loops.map((loop) => loop.members.length)).toEqual([1, 1])
      expect(loops.every((loop) => !loop.top)).toBe(true)
      const data = [...recycling, { flow: 3, from: 'Product', to: 'Factory' }]
      expect(lanes(data, 1, 1, { bundle: false }).loops).toHaveLength(3)
    })

    it("bundles the back flows to one node into a lane with 'target', the nearest source first", () => {
      const { loops, space } = lanes(recycling, 1, 1, { bundle: 'target' })
      expect(loops).toHaveLength(1)
      const [loop] = loops
      expect(members(loop)).toEqual(['Product', 'Use'])
      expect([loop.first, loop.last]).toEqual([1, 3])
      // each member runs outside the thickness of the ones that joined before it
      expect(loop.inner.get(loop.members[0])).toBe(0)
      expect(loop.inner.get(loop.members[1])).toBe(8)
      expect(loop.t).toBe(28)
      // they turn at different sources, but around each other at the target
      expect(loop.innerOut.get(loop.members[1])).toBe(0)
      expect(loop.innerIn.get(loop.members[0])).toBe(0)
      expect(loop.innerIn.get(loop.members[1])).toBe(8)
      // the lane takes the room of one flow of its total thickness
      expect(space.depth[2]).toBe(loop.level + 28 + END_GAP)
      // the ranks of the ports order the members within the lane
      const [near, far] = loop.members
      expect(near.rank).toBeLessThan(far.rank as number)
      expect(near.lane).toBe(far.lane)
    })

    describe("with 'source'", () => {
      // Use returns to Product and to Factory
      const data = [...recycling, { flow: 6, from: 'Use', to: 'Product' }]
      const bundled = () => lanes(data, 1, 1, { bundle: 'source' })

      it('puts the back flows that leave one node in a lane, whatever their targets', () => {
        const { loops } = bundled()
        // Product -> Factory is a lane of its own, the two from Use share one
        expect(loops.map((loop) => loop.members.length).sort()).toEqual([1, 2])
        const lane = loops.find((loop) => loop.members.length === 2) as (typeof loops)[number]
        expect(lane.members.map((link) => link.to.key)).toEqual(['Product', 'Factory'])
        // from the nearest target column to the farthest source column
        expect([lane.first, lane.last]).toEqual([1, 3])
        expect(lane.link).toBe(lane.members[0])
      })

      it('turns concentrically at the shared source, the shorter flow inside', () => {
        const lane = bundled().loops.find((loop) => loop.members.length === 2) as ReturnType<
          typeof bundled
        >['loops'][number]
        const [short, long] = lane.members
        expect(lane.innerOut.get(short)).toBe(0)
        expect(lane.innerOut.get(long)).toBe(6)
        // at the different targets nothing is inside
        expect(lane.innerIn.get(short)).toBe(0)
        expect(lane.innerIn.get(long)).toBe(0)
        expect(lane.tAt.get(short.from)).toBe(26)
      })

      it('grows the radius and moves the turn out by what is inside', () => {
        const data2 = [
          { flow: 10, from: 'A', to: 'B' },
          { flow: 10, from: 'B', to: 'C' },
          { flow: 10, from: 'C', to: 'D' },
          { flow: 3, from: 'D', to: 'C' },
          { flow: 2, from: 'D', to: 'B' },
        ]
        const plan = buildTopology(data2, { backFlows: { bundle: 'source' } })
        const loops = buildLoops(plan)
        expect(loops).toHaveLength(1)
        const [loop] = loops
        const space = measureLoops(loops, plan.maxColumn + 1, 10, 1)
        const [short, long] = loop.members
        expect(long.flow).toBe(2)
        // the short member (D to C) has nothing inside it and the other goes round it
        expect(loop.innerOut.get(short)).toBe(0)
        expect(loop.innerOut.get(long)).toBe(30)
        // the column of the source keeps room for the thickness of both turns
        expect(space.out[loop.last]).toBeGreaterThan(30 + 20)
      })
    })

    it('keeps self flows out of the lane of their node', () => {
      const { loops } = lanes([...recycling, { flow: 3, from: 'Factory', to: 'Factory' }], 1, 1, {
        bundle: 'target',
      })
      expect(loops).toHaveLength(2)
      expect(loops.map((loop) => loop.members.length).sort()).toEqual([1, 2])
    })

    it("runs the lanes after the content with side 'end'", () => {
      const { loops, space } = lanes(ring, 1, 1, { side: 'end' })
      expect(loops.map((loop) => loop.top)).toEqual([false])
      expect(space.depthTop).toEqual([0, 0, 0])
      expect(space.depth).toEqual(new Array(3).fill(FIRST_GAP + 4 + END_GAP))
    })

    it("runs the lanes before the content with side 'start'", () => {
      const { loops, space } = lanes(ring, 1, 1, { side: 'start' })
      expect(loops.map((loop) => loop.top)).toEqual([true])
      expect(space.depth).toEqual([0, 0, 0])
      expect(space.depthTop).toEqual(new Array(3).fill(FIRST_GAP + 4 + END_GAP))
    })

    it('places a lane before the content growing away from it', () => {
      const plan = buildTopology(nested, { backFlows: { side: 'start' } })
      const loops = buildLoops(plan)
      measureLoops(loops, plan.maxColumn + 1, 10, 1)
      const [inner, outer] = loops
      placeLoops(loops, [100, 120, 130, 140], [200, 220, 230, 240], 1)
      // the edge next to the content, the band lies on the far side of it
      expect(inner.start).toBe(130 - FIRST_GAP)
      // the outer one is stacked beyond the inner one
      expect(outer.start).toBe(inner.start - inner.t - LANE_GAP)
      // or goes right before the content of its columns, when that is further out
      placeLoops(loops, [20, 120, 130, 140], [200, 220, 230, 240], 1)
      expect(outer.start).toBe(20 - FIRST_GAP)
    })

    it("chooses the side of a lane in 'auto' by where its ends are", () => {
      const small = [
        { flow: 10, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'C' },
        { flow: 4, from: 'C', to: 'B' },
      ]
      const big = [
        { flow: 50, from: 'P', to: 'Q' },
        { flow: 50, from: 'Q', to: 'R' },
      ]
      const tops = (data: typeof ring, side: 'auto' | 'end') =>
        lanes(data, 1, 1, { side }).loops.map((loop) => loop.top)
      // the small chain is in the upper half of its columns
      const upper = [...small, ...big]
      expect(buildTopology(upper, {}).slots[0].map((slot) => slot.node?.key)).toEqual(['A', 'P'])
      expect(tops(upper, 'end')).toEqual([false])
      expect(tops(upper, 'auto')).toEqual([true])
      // and in the lower half when it comes after the big one
      const lower = [...big, ...small]
      expect(buildTopology(lower, {}).slots[0].map((slot) => slot.node?.key)).toEqual(['P', 'A'])
      expect(tops(lower, 'auto')).toEqual([false])
    })

    it("sends a loop within one column round its target in 'auto'", () => {
      const data = [
        { flow: 10, from: 'A', to: 'B' },
        { flow: 6, from: 'B', to: 'C' },
        { flow: 4, from: 'B', to: 'D' },
        { flow: 3, from: 'C', to: 'D' },
      ]
      const plan = buildTopology(data, {
        backFlows: { side: 'auto' },
        column: { C: 2, D: 2 },
      })
      const [link] = plan.loops
      expect(link.from.key).toBe('C')
      expect(link.to.key).toBe('D')
      const rowOf = (key: string) => plan.slots[2].findIndex((slot) => slot.node?.key === key)
      // the lane is on the side of the target away from the source
      expect(link.top).toBe(rowOf('D') < rowOf('C'))
    })
  })
})
