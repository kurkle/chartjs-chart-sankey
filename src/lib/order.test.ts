import { countCrossings, orderSlots, ROUNDS } from './order.js'

// Slots 0..3 in column 0 and 4..7 in column 1; edges are listed as [from, to, flow].
function graph(
  columns: number[][],
  edges: Array<[number, number, number]>,
  rank: Array<number | undefined> = [],
  stubs: Array<{ id: number; column: number; end: 'in' | 'out'; weight: number }> = []
) {
  const size = columns.flat().length
  const ups: Array<Array<[number, number]>> = Array.from({ length: size }, () => [])
  const downs: Array<Array<[number, number]>> = Array.from({ length: size }, () => [])
  for (const [a, b, flow] of edges) {
    downs[a].push([b, flow])
    ups[b].push([a, flow])
  }
  return { columns, downs, rank, stubs, ups }
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
    expect(countCrossings(g.columns, g.downs)).toBe(1)
    expect(
      countCrossings(
        [
          [0, 1],
          [3, 2],
        ],
        g.downs
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
    expect(countCrossings(order, g.downs)).toBe(0)
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
    expect(countCrossings(orderSlots(g), g.downs)).toBeLessThanOrEqual(
      countCrossings(g.columns, g.downs)
    )
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
    expect(ROUNDS).toBe(4)
  })

  it('counts a band beyond the end of a back flow as a crossing', () => {
    // slots 0 (a node with a back flow) and 1 above/below it, both going to the next column
    const stubs = [{ column: 0, end: 'out' as const, id: 0, weight: 5 }]
    const g = graph(
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2, 1],
        [1, 3, 1],
      ],
      [],
      stubs
    )
    // slot 1 is below slot 0, so its band passes the way the back flow leaves
    expect(countCrossings(g.columns, g.downs, stubs)).toBe(1)
    expect(
      countCrossings(
        [
          [1, 0],
          [3, 2],
        ],
        g.downs,
        stubs
      )
    ).toBe(0)
  })

  it('puts the band that is not to cross a back flow on the other side of its node', () => {
    const stubs = [{ column: 1, end: 'out' as const, id: 1, weight: 20 }]
    // the waypoint (2) of a skipping flow starts below the node (1) with the back flow
    const g = graph(
      [[0], [1, 2], [3, 4]],
      [
        [0, 1, 1],
        [0, 2, 1],
        [1, 3, 1],
        [2, 4, 1],
      ],
      [],
      stubs
    )
    const order = orderSlots(g)
    expect(countCrossings(order, g.downs, stubs)).toBe(0)
    expect(order[1]).toEqual([2, 1])
  })
})
