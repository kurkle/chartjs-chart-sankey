import { floor, measure, planLaneSpace, SELF_CORNER, termPixels } from './lane-space.js'
import { buildTopology } from './topology.js'

const ring = [
  { flow: 10, from: 'a', to: 'b' },
  { flow: 10, from: 'b', to: 'c' },
  { flow: 4, from: 'c', to: 'a' },
]

describe('lib/lane-space', () => {
  it('needs no room without back flows', () => {
    const space = planLaneSpace(buildTopology([{ flow: 1, from: 'a', to: 'b' }], {}), 1)
    expect(space.lanes).toHaveLength(0)
    expect(measure(space.cross, 5, 1)).toBe(0)
    expect(measure(space.lead, 5, 1)).toBe(0)
    expect(measure(space.trail, 5, 1)).toBe(0)
    expect(space.gaps.map((gap) => measure(gap, 5, 1))).toEqual([0])
  })

  it('takes the thickness of the lanes from the cross axis, scaled', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    expect(space.lanes).toHaveLength(1)
    const small = measure(space.cross, 1, 1)
    const large = measure(space.cross, 11, 1)
    // 4 units of lane thickness: 10 more pixels per unit
    expect(large - small).toBeCloseTo(40, 9)
  })

  it('never lets a lane vanish', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    expect(termPixels(space.lanes[0].thickness, 0, 1)).toBe(1)
    expect(termPixels(space.lanes[0].thickness, 0, 0.25)).toBe(0.25)
  })

  it('keeps room before the first and after the last column for the turns', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    // a turn needs its band, its radius and the node border, and the scale only grows it
    expect(measure(space.lead, 0, 1)).toBeGreaterThan(1)
    expect(measure(space.trail, 0, 1)).toBeGreaterThan(1)
    expect(measure(space.lead, 3, 1)).toBeGreaterThan(measure(space.lead, 0, 1))
  })

  it('keeps a minimum run in every gap once there is a lane', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 1)
    expect(space.gaps).toHaveLength(2)
    for (const gap of space.gaps) expect(floor(gap)).toBeGreaterThan(0)
  })

  it('shrinks the shrinkable pixels and the minimum thickness, but not the border', () => {
    const space = planLaneSpace(buildTopology(ring, {}), 3)
    expect(measure(space.lead, 0, 0)).toBe(3)
    expect(measure(space.lead, 0, 1)).toBeGreaterThan(measure(space.lead, 0, 0.5))
  })

  it('stacks the turns of an outer lane around the inner lanes', () => {
    const nested = [
      { flow: 12, from: 'A', to: 'B' },
      { flow: 10, from: 'B', to: 'C' },
      { flow: 8, from: 'C', to: 'D' },
      { flow: 5, from: 'D', to: 'C' },
      { flow: 2, from: 'D', to: 'A' },
    ]
    const space = planLaneSpace(buildTopology(nested, {}), 0)
    expect(space.lanes).toHaveLength(2)
    expect(space.lanes[1].before).toEqual([space.lanes[0].thickness])
    expect(space.lanes[1].lift).toBeGreaterThan(space.lanes[0].lift)
    // the last column holds the turns of both loops, the outer one measured around the inner one
    expect(measure(space.trail, 10, 1)).toBeGreaterThan(measure(space.trail, 0, 1) + 10 * 5)
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
    expect(space.lanes[0].clear).toBe(SELF_CORNER)
    expect(space.firstGap).toBe(2 * SELF_CORNER)
    expect(space.trail.shrinkable).toBeGreaterThan(SELF_CORNER)
  })
})
