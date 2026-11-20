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

function lanes(data: typeof ring, k: number, factor = 1) {
  const plan = buildTopology(data, {})
  const loops = buildLoops(plan)
  return { loops, space: measureLoops(loops, plan.maxColumn + 1, k, factor) }
}

describe('lib/lane-space', () => {
  it('needs no room without back flows', () => {
    const { loops, space } = lanes([{ flow: 1, from: 'a', to: 'b' }], 5)
    expect(loops).toHaveLength(0)
    expect(space).toEqual({ depth: [0, 0], into: [0, 0], out: [0, 0], run: 0 })
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
    expect(outer.out).toBe(inner.t + LANE_GAP)
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
    placeLoops(loops, [200, 40, 50, 60], 1)
    expect(inner.start).toBe(60 + FIRST_GAP)
    expect(outer.start).toBe(200 + FIRST_GAP)
    placeLoops(loops, [10, 40, 50, 60], 1)
    expect(outer.start).toBe(inner.start + inner.t + LANE_GAP)
  })
})
