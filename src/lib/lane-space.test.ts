import { SELF_CORNER } from './constants.js'
import { floor, measure, planLaneSpace, termPixels } from './lane-space.js'
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

describe('lib/lane-space', () => {
  it('needs no room without back flows', () => {
    const space = planLaneSpace(buildTopology([{ flow: 1, from: 'a', to: 'b' }], {}), 1)
    expect(space.loops).toHaveLength(0)
    expect(space.columns.every((stacks) => stacks.length === 0)).toBe(true)
    expect(measure(space.lead, 5, 1)).toBe(0)
    expect(measure(space.trail, 5, 1)).toBe(0)
    expect(space.gaps.map((gap) => measure(gap, 5, 1))).toEqual([0])
  })

  it('takes the thickness of a loop from the columns it passes, scaled', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    expect(space.loops).toHaveLength(1)
    const [stack] = space.columns[1]
    // 4 units of thickness: 10 more pixels per unit
    expect(measure(stack, 11, 1) - measure(stack, 1, 1)).toBeCloseTo(40, 9)
  })

  it('never lets a lane vanish', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    expect(termPixels(space.loops[0].thickness, 0, 1)).toBe(1)
    expect(termPixels(space.loops[0].thickness, 0, 0.25)).toBe(0.25)
  })

  it('charges a loop only to the columns it runs under', () => {
    const data = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 10, from: 'B', to: 'C' },
      { flow: 10, from: 'C', to: 'D' },
      { flow: 10, from: 'D', to: 'E' },
      { flow: 3, from: 'B', to: 'A' },
    ]
    const space = planLaneSpace(buildTopology(data, {}), 1)
    expect(space.columns.map((stacks) => stacks.length)).toEqual([1, 1, 0, 0, 0])
  })

  it('lets loops that do not overlap share a level', () => {
    const data = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 10, from: 'B', to: 'C' },
      { flow: 10, from: 'C', to: 'D' },
      { flow: 10, from: 'D', to: 'E' },
      { flow: 10, from: 'E', to: 'F' },
      { flow: 3, from: 'B', to: 'A' },
      { flow: 4, from: 'F', to: 'E' },
    ]
    const space = planLaneSpace(buildTopology(data, {}), 1)
    expect(space.loops).toHaveLength(2)
    // neither stacks on the other, so each takes only its own thickness
    expect(space.loops.map((loop) => loop.cross.chain.length)).toEqual([0, 0])
    expect(space.columns.every((stacks) => stacks.length <= 1)).toBe(true)
  })

  it('stacks overlapping loops: the outer one on the inner one', () => {
    const space = planLaneSpace(buildTopology(nested, {}), 0)
    expect(space.loops).toHaveLength(2)
    expect(space.loops[1].below).toEqual([space.loops[0]])
    expect(space.loops[1].cross.chain).toEqual([space.loops[0].thickness])
    expect(space.loops[1].cross.lift).toBeGreaterThan(space.loops[0].cross.lift)
    // the last column holds the turns of both loops, the outer one measured around the inner one
    expect(measure(space.trail, 10, 1)).toBeGreaterThan(measure(space.trail, 0, 1) + 10 * 5)
  })

  it('takes the room of the loops under a loop into the columns of the loops above', () => {
    const space = planLaneSpace(buildTopology(nested, {}), 0)
    const reach = (rank: number) => [...space.loops[rank].reach].sort()
    expect(reach(1)).toEqual([0, 1, 2, 3])
  })

  it('shrinks the shrinkable pixels and the minimum thickness, but not the border', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 3)
    expect(measure(space.lead, 0, 0)).toBe(3)
    expect(measure(space.lead, 0, 1)).toBeGreaterThan(measure(space.lead, 0, 0.5))
    expect(floor(space.columns[0][0])).toBeGreaterThan(1)
  })

  it('gives a flow to the node itself a wider inner radius', () => {
    const space = planLaneSpace(
      buildTopology(
        [
          { flow: 5, from: 'A', to: 'B' },
          { flow: 2, from: 'B', to: 'B' },
        ],
        {}
      ),
      0
    )
    expect(space.loops[0].clear).toBe(SELF_CORNER)
    expect(space.loops[0].cross.lift).toBeGreaterThanOrEqual(2 * SELF_CORNER)
    expect(space.trail.shrinkable).toBeGreaterThan(SELF_CORNER)
  })
})
