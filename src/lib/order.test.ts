import type { Hook } from './order.js'

import { ROUNDS } from './constants.js'
import { countCrossings, indexHooks, orderSlots, swapDelta } from './order.js'

// Slots 0..3 in column 0 and 4..7 in column 1; edges are listed as [from, to, flow].
function graph(
  columns: number[][],
  edges: Array<[number, number, number]>,
  rank: Array<number | undefined> = [],
  hooks: Hook[] = []
) {
  const size = columns.flat().length
  const ups: Array<Array<[number, number]>> = Array.from({ length: size }, () => [])
  const downs: Array<Array<[number, number]>> = Array.from({ length: size }, () => [])
  for (const [a, b, flow] of edges) {
    downs[a].push([b, flow])
    ups[b].push([a, flow])
  }
  return { columns, downs, hooks, rank, ups }
}

describe('lib/order', () => {
  it('counts crossings between neighbouring columns', () => {
    const g = graph(
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 3, 1],
        [1, 2, 1],
      ]
    )
    expect(countCrossings(g.columns, g)).toBe(1)
    expect(
      countCrossings(
        [
          [0, 1],
          [3, 2],
        ],
        g
      )
    ).toBe(0)
  })

  it('untangles a crossing by moving slots towards their neighbours', () => {
    const g = graph(
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 3, 1],
        [1, 2, 1],
      ]
    )
    const order = orderSlots(g)
    expect(countCrossings(order, g)).toBe(0)
  })

  it('keeps the initial order when nothing crosses', () => {
    const g = graph(
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2, 1],
        [1, 3, 1],
      ]
    )
    expect(orderSlots(g)).toEqual([
      [0, 1],
      [2, 3],
    ])
  })

  it('is deterministic', () => {
    const edges: Array<[number, number, number]> = [
      [0, 6, 2],
      [1, 4, 3],
      [2, 5, 1],
      [3, 7, 4],
      [0, 5, 1],
    ]
    const g = graph(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
      edges
    )
    expect(orderSlots(g)).toEqual(orderSlots(g))
  })

  it('never ends with more crossings than it began with', () => {
    const g = graph(
      [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      [
        [0, 5, 1],
        [1, 3, 1],
        [2, 4, 1],
        [3, 8, 1],
        [4, 6, 1],
        [5, 7, 1],
      ]
    )
    expect(countCrossings(orderSlots(g), g)).toBeLessThanOrEqual(countCrossings(g.columns, g))
  })

  it('keeps the slots that have a rank in rank order', () => {
    const g = graph(
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 3, 1],
        [1, 2, 1],
      ],
      [undefined, undefined, 1, 0]
    )
    const order = orderSlots(g)
    expect(order[1]).toEqual([3, 2])
  })

  it('has a fixed number of rounds', () => {
    expect(ROUNDS).toBe(3)
  })

  it('counts a band that meets a slot between the ends of a turn as a crossing', () => {
    // slot 0 is a node whose back flow turns to slot 2, with slot 1 between them
    const hooks: Hook[] = [{ a: 0, b: 2, column: 0, side: 'right', weight: 5 }]
    const g = graph(
      [
        [0, 1, 2],
        [3, 4, 5],
      ],
      [
        [0, 3, 1],
        [1, 4, 2],
        [2, 5, 1],
      ],
      [],
      hooks
    )
    // the turn crosses the band of slot 1, and weighs the smaller flow
    expect(countCrossings(g.columns, g)).toBe(2)
    expect(
      countCrossings(
        [
          [0, 2, 1],
          [3, 5, 4],
        ],
        g
      )
    ).toBe(0)
  })

  it('counts turns that interleave, and not turns that nest or are apart', () => {
    const hook = (a: number, b: number, weight: number): Hook => ({
      a,
      b,
      column: 0,
      side: 'right',
      weight,
    })
    const columns = [[0, 1, 2, 3, 4, 5]]
    const count = (hooks: Hook[]) => countCrossings(columns, graph(columns, [], [], hooks))
    expect(count([hook(0, 2, 3), hook(1, 3, 4)])).toBe(3)
    expect(count([hook(0, 3, 3), hook(1, 2, 4)])).toBe(0)
    expect(count([hook(0, 1, 3), hook(2, 3, 4)])).toBe(0)
    // turns that share a slot are ordered at its edge, so they do not cross
    expect(count([hook(0, 2, 3), hook(0, 1, 4)])).toBe(0)
  })

  it('moves a loop slot next to its node when that removes the crossing with a band', () => {
    // the loop slot (1) starts below the band of node 2 and the turn of node 0 crosses it
    const hooks: Hook[] = [{ a: 0, b: 1, column: 0, side: 'right', weight: 20 }]
    const g = graph(
      [
        [0, 2, 1],
        [3, 4],
      ],
      [
        [0, 3, 1],
        [2, 4, 8],
      ],
      [],
      hooks
    )
    const order = orderSlots(g)
    expect(countCrossings(order, g)).toBe(0)
  })

  it('works out the change a swap makes to the turns as a recount does', () => {
    let seed = 11
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed
    }
    const columns = [
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10, 11],
    ]
    const edges: Array<[number, number, number]> = []
    for (let i = 0; i < 14; i++) edges.push([next() % 6, 6 + (next() % 6), 1 + (next() % 5)])
    const hooks: Hook[] = []
    for (let i = 0; i < 6; i++) {
      const column = next() % 2
      const a = column * 6 + (next() % 6)
      const b = column * 6 + (((a % 6) + 1 + (next() % 5)) % 6)
      hooks.push({ a, b, column, side: next() % 2 ? 'left' : 'right', weight: 1 + (next() % 7) })
    }
    const g = graph(columns, edges, [], hooks)
    const index = indexHooks(g)
    for (let trial = 0; trial < 60; trial++) {
      const order = columns.map((column) => [...column].sort(() => (next() % 3) - 1))
      const c = next() % 2
      const i = next() % 5
      const swapped = order.map((column) => [...column])
      ;[swapped[c][i], swapped[c][i + 1]] = [swapped[c][i + 1], swapped[c][i]]
      const pos: number[] = []
      for (const column of order) {
        column.forEach((id, p) => {
          pos[id] = p
        })
      }
      const [weight, count] = swapDelta(order[c][i], order[c][i + 1], g, index, pos)
      const before = countCrossings(order, g)
      const after = countCrossings(swapped, g)
      expect(weight).toBeCloseTo(after - before, 9)
      expect(Number.isInteger(count)).toBe(true)
    }
  })

  it('weighs a crossing by the smaller of its two flows, as a brute force count does', () => {
    // a deterministic pseudo random graph of three columns of six slots
    let seed = 7
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed
    }
    const edges: Array<[number, number, number]> = []
    for (let i = 0; i < 40; i++) {
      edges.push([next() % 6, 6 + (next() % 6), 1 + (next() % 9)])
      edges.push([6 + (next() % 6), 12 + (next() % 6), 1 + (next() % 9)])
    }
    const g = graph(
      [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11],
        [12, 13, 14, 15, 16, 17],
      ],
      edges
    )
    const order = [
      [3, 0, 5, 1, 4, 2],
      [9, 6, 11, 8, 7, 10],
      [14, 12, 17, 13, 16, 15],
    ]
    const pos = new Map(order.flatMap((column) => column.map((id, i) => [id, i] as const)))
    let expected = 0
    for (let a = 0; a < edges.length; a++) {
      for (let b = a + 1; b < edges.length; b++) {
        const [fa, ta, wa] = edges[a]
        const [fb, tb, wb] = edges[b]
        const sameGap = Math.floor(fa / 6) === Math.floor(fb / 6)
        const [pfa, pta, pfb, ptb] = [fa, ta, fb, tb].map((id) => pos.get(id) as number)
        if (sameGap && (pfa - pfb) * (pta - ptb) < 0) expected += Math.min(wa, wb)
      }
    }
    expect(countCrossings(order, g)).toBe(expected)
  })
})
