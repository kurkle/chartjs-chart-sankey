import type { SankeyNode } from '../types.js'
import type { PlanLink, PlanSlot } from './topology.js'

import { ROUNDS } from './constants.js'
import { countCrossings, orderSlots } from './order.js'

type Stub = { id: number; column: number; end: 'in' | 'out'; weight: number }

// Slots by number, a column each list; edges are listed as [from, to, flow]. A
// slot with a rank is a node with that priority, and a stub is the end of a
// back flow that is drawn.
function graph(
  columns: number[][],
  edges: Array<[number, number, number]>,
  rank: Array<number | undefined> = [],
  stubs: Stub[] = []
) {
  const slots = new Map<number, PlanSlot>()
  columns.forEach((ids, column) => {
    for (const id of ids) {
      const node = rank[id] === undefined ? undefined : ({ priority: rank[id] } as SankeyNode)
      slots.set(id, { column, in: [], key: `${id}`, node, out: [], size: 0 })
    }
  })
  const slot = (id: number) => slots.get(id) as PlanSlot
  const link = (flow: number, path: PlanSlot[], back: boolean) =>
    ({ back, flow, path, rank: back ? 0 : undefined }) as PlanLink
  for (const [a, b, flow] of edges) {
    const forward = link(flow, [slot(a), slot(b)], false)
    slot(a).out.push(forward)
    slot(b).in.push(forward)
  }
  for (const stub of stubs) {
    const loop = link(stub.weight, [slot(stub.id), slot(stub.id)], true)
    slot(stub.id)[stub.end].push(loop)
  }
  const ranked = rank.some((value) => value !== undefined)
  const toSlots = (order: number[][]) => order.map((ids) => ids.map(slot))
  const toIds = (order: PlanSlot[][]) => order.map((column) => column.map((s) => Number(s.key)))
  return {
    columns,
    /** crossings of an order given by number */
    crossings: (order: number[][]) => countCrossings(toSlots(order)),
    order: () => toIds(orderSlots(toSlots(columns), ranked)),
  }
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
    expect(g.crossings(g.columns)).toBe(1)
    expect(
      g.crossings([
        [0, 1],
        [3, 2],
      ])
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
    const order = g.order()
    expect(g.crossings(order)).toBe(0)
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
    expect(g.order()).toEqual([
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
    expect(g.order()).toEqual(g.order())
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
    expect(g.crossings(g.order())).toBeLessThanOrEqual(g.crossings(g.columns))
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
    const order = g.order()
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
    expect(g.crossings(g.columns)).toBe(1)
    expect(
      g.crossings([
        [1, 0],
        [3, 2],
      ])
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
    const order = g.order()
    expect(g.crossings(order)).toBe(0)
    expect(order[1]).toEqual([2, 1])
  })
})
