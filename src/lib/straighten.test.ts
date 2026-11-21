import type { Place, Stack } from './straighten.js'

import { straighten } from './straighten.js'

const stack = (tops: number[], bars: number[], end = 100, gap = 0): Stack => ({
  bars,
  end,
  gaps: bars.slice(1).map(() => gap),
  start: 0,
  tops,
})

/** No slot before the start or after the end of its column, and none nearer to the one before it than their gap. */
function expectFits(stacks: Stack[]) {
  for (const { bars, end, gaps, start, tops } of stacks) {
    tops.forEach((top, i) => {
      const least = i ? tops[i - 1] + bars[i - 1] + gaps[i - 1] : start
      expect(top).toBeGreaterThanOrEqual(least - 1e-6)
    })
    expect((tops.at(-1) as number) + (bars.at(-1) as number)).toBeLessThanOrEqual(end + 1e-6)
  }
}

describe('straighten', () => {
  it('puts the waypoints of a flow on one level', () => {
    // a waypoint of 10 above a node in one column, and below a node in the next
    const stacks = [stack([0, 60], [10, 20]), stack([10, 70], [20, 10])]
    const chain: Place[] = [
      [0, 0],
      [1, 1],
    ]
    expect(straighten(stacks, [chain])).toBe(true)
    expect(stacks[0].tops[0]).toBeCloseTo(stacks[1].tops[1], 8)
    expectFits(stacks)
  })

  it('leaves a bend, and everything where it was, when the columns are too full', () => {
    // the waypoint is after 90 px of node in one column and before 90 px of node in the next
    const stacks = [stack([0, 90], [90, 10]), stack([0, 10], [10, 90])]
    expect(
      straighten(stacks, [
        [
          [0, 1],
          [1, 0],
        ],
      ])
    ).toBe(false)
    expect(stacks.map((s) => s.tops)).toEqual([
      [0, 90],
      [0, 10],
    ])
  })

  it('levels the flows it is given first, and bends one that crosses them', () => {
    // two flows swap places between the columns: only one of them can run level
    const stacks = [stack([10, 40], [20, 10]), stack([20, 60], [10, 20])]
    const thick: Place[] = [
      [0, 0],
      [1, 1],
    ]
    const thin: Place[] = [
      [0, 1],
      [1, 0],
    ]
    expect(straighten(stacks, [thick, thin])).toBe(true)
    expect(stacks[0].tops[0]).toBeCloseTo(stacks[1].tops[1], 8)
    expect(stacks[0].tops[1]).not.toBeCloseTo(stacks[1].tops[0], 3)
    expectFits(stacks)
  })

  it('leaves no trace of a tie that did not fit', () => {
    // The first flow would have to start at 85 in its first column, where two nodes of 40
    // come after it: the tie fails after it has moved levels. The second flow can be tied.
    const stacks = [
      stack([0, 10, 50], [10, 40, 40]),
      stack([0, 85], [85, 10]),
      stack([0, 60], [10, 20]),
      stack([40, 70], [10, 20]),
    ]
    const failing: Place[] = [
      [0, 0],
      [1, 1],
    ]
    const fitting: Place[] = [
      [2, 0],
      [3, 0],
    ]
    expect(straighten(stacks, [failing, fitting])).toBe(true)
    expect(stacks[2].tops[0]).toBeCloseTo(stacks[3].tops[0], 8)
    // the two waypoints of the first flow are still apart, each within its own column
    expect(stacks[0].tops[0]).toBeLessThanOrEqual(10)
    expect(stacks[1].tops[1]).toBeGreaterThanOrEqual(85)
    expectFits(stacks)
  })

  it('levels a part of a flow when it cannot level all of it', () => {
    const stacks = [stack([0, 90], [90, 10]), stack([0, 10], [10, 90]), stack([30, 60], [10, 20])]
    const chain: Place[] = [
      [0, 1],
      [1, 0],
      [2, 0],
    ]
    expect(straighten(stacks, [chain])).toBe(true)
    expect(stacks[0].tops[1]).toBe(90)
    expect(stacks[1].tops[0]).toBeCloseTo(0, 8)
    expect(stacks[2].tops[0]).toBeCloseTo(0, 8)
    expectFits(stacks)
  })

  it('puts a level flow at the mean of its waypoints when nothing is in the way', () => {
    const stacks = [stack([0, 70], [10, 20], 100, 5), stack([80], [10])]
    const chain: Place[] = [
      [0, 0],
      [1, 0],
    ]
    expect(straighten(stacks, [chain])).toBe(true)
    expect(stacks.map((s) => s.tops)).toEqual([[40, 70], [40]])
  })

  it('shares the way with a neighbour rather than overlap it', () => {
    // the mean of the waypoints is 30, where the first one would run into the node after it
    const stacks = [stack([0, 12], [10, 30], 100, 2), stack([60], [10])]
    const chain: Place[] = [
      [0, 0],
      [1, 0],
    ]
    expect(straighten(stacks, [chain])).toBe(true)
    // pushed on, the node gives way to 42; pushed back, the flow gives way to 0
    expect(stacks.map((s) => s.tops)).toEqual([[15, 27], [15]])
    expectFits(stacks)
  })
})
