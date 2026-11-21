import type { Place, Stack, Tie } from './straighten.js'

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
    expect(straighten(stacks, [chain], [], 4)).toBe(true)
    expect(stacks[0].tops[0]).toBeCloseTo(stacks[1].tops[1], 8)
    expectFits(stacks)
  })

  it('leaves a bend, and everything where it was, when the columns are too full', () => {
    // the waypoint is after 90 px of node in one column and before 90 px of node in the next
    const stacks = [stack([0, 90], [90, 10]), stack([0, 10], [10, 90])]
    expect(
      straighten(
        stacks,
        [
          [
            [0, 1],
            [1, 0],
          ],
        ],
        [],
        4
      )
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
    expect(straighten(stacks, [thick, thin], [], 4)).toBe(true)
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
    expect(straighten(stacks, [failing, fitting], [], 4)).toBe(true)
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
    expect(straighten(stacks, [chain], [], 4)).toBe(true)
    expect(stacks[0].tops[1]).toBe(90)
    expect(stacks[1].tops[0]).toBeCloseTo(0, 8)
    expect(stacks[2].tops[0]).toBeCloseTo(0, 8)
    expectFits(stacks)
  })

  it('moves a level flow to where it meets its ends, and keeps the gaps', () => {
    // a node in the first column, two waypoints, a node in the last: the ties ask for level 40
    const stacks = [
      stack([40], [10]),
      stack([0, 70], [10, 20], 100, 5),
      stack([80], [10]),
      stack([40], [10]),
    ]
    const chain: Place[] = [
      [1, 0],
      [2, 0],
    ]
    const ties: Tie[] = [
      { a: [0, 0], b: [1, 0], shift: 0, weight: 1 },
      { a: [1, 0], b: [2, 0], shift: 0, weight: 1 },
      { a: [2, 0], b: [3, 0], shift: 0, weight: 1 },
    ]
    expect(straighten(stacks, [chain], ties, 32)).toBe(true)
    expect(stacks[1].tops[0]).toBeCloseTo(40, 3)
    expect(stacks[2].tops[0]).toBeCloseTo(40, 3)
    expectFits(stacks)
  })

  it('pushes a neighbour on rather than overlap it', () => {
    const stacks = [stack([0], [10]), stack([0, 12], [10, 30], 100, 2), stack([60, 80], [10, 10])]
    const chain: Place[] = [
      [1, 0],
      [2, 0],
    ]
    // the node of the first column pulls the flow to level 0, the last column holds it later
    const ties: Tie[] = [{ a: [2, 0], b: [0, 0], shift: -60, weight: 5 }]
    expect(straighten(stacks, [chain], ties, 16)).toBe(true)
    expect(stacks[1].tops[0]).toBeCloseTo(stacks[2].tops[0], 8)
    expectFits(stacks)
  })
})
