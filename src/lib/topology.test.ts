import type { Plan } from './topology.js'

import { buildTopology } from './topology.js'

/** The nodes of each column in drawing order, and the slot of a node. */
const nodesByColumn = (plan: Plan) =>
  plan.slots.map((column) => column.flatMap((slot) => (slot.node ? [slot.node] : [])))
const slotOf = (plan: Plan, key: string) => plan.slots.flat().find((slot) => slot.node?.key === key)

function formatValue(value: any) {
  if (Number.isNaN(value)) {
    return 'NaN'
  }
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function formatDescription(description: string, args: any[]) {
  let index = 0
  return description.replaceAll('%p', () => formatValue(args[index++]))
}

function each(cases: any[][]) {
  return (description: string, fn: (...args: any[]) => void) => {
    cases.forEach((args) => {
      it(formatDescription(description, args), () => fn(...args))
    })
  }
}

function columnsOf(data: Array<{ flow: number; from: string; to: string }>, options = {}) {
  const plan = buildTopology(data, options)
  return { back: plan.links.filter((l) => l.back).map((l) => l.index), plan }
}

describe('lib/topology', () => {
  describe('calculateX', () => {
    it('should work with empty chart', () => {
      expect(buildTopology([], { modeX: 'edge' }).maxColumn).toEqual(0)
      expect(buildTopology([], { modeX: 'even' }).maxColumn).toEqual(0)
    })
    each([
      [
        '1x2',
        [{ flow: 1, from: 'a', to: 'b' }],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
        ],
        1,
      ],
      [
        '1x3',
        [
          { flow: 2, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
        ],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
        ],
        2,
      ],
      [
        '2x2',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'c', to: 'd' },
        ],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 0 },
          { key: 'd', x: 1 },
        ],
        1,
      ],
      [
        '2x3 edge',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'c', to: 'd' },
          { flow: 1, from: 'd', to: 'e' },
        ],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 2 },
          { key: 'c', x: 0 },
          { key: 'd', x: 1 },
          { key: 'e', x: 2 },
        ],
        2,
      ],
      [
        '2x3 even',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'c', to: 'd' },
          { flow: 1, from: 'd', to: 'e' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 0 },
          { key: 'd', x: 1 },
          { key: 'e', x: 2 },
        ],
        2,
      ],
    ])('should map nodes to columns: %p', (_test, data, mode, expected, maxX) => {
      const plan = buildTopology(data, { modeX: mode })
      expect(plan.maxColumn).toEqual(maxX)
      expect([...plan.nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
    })

    each([
      ['1x1 circular', [{ flow: 1, from: 'a', to: 'a' }], 'even' as const, [{ key: 'a', x: 0 }], 0],
      [
        '2x1 circular',
        [
          { flow: 1, from: 'a', to: 'a' },
          { flow: 1, from: 'b', to: 'b' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 0 },
        ],
        0,
      ],
      [
        '1x2 circular',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'b' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
        ],
        1,
      ],

      [
        '2x2 circular',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'c', to: 'd' },
          { flow: 1, from: 'd', to: 'd' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 0 },
          { key: 'd', x: 1 },
        ],
        1,
      ],
    ])(
      'should map nodes with simple circular flows to columns: %p',
      (_test, data, mode, expected, maxX) => {
        const plan = buildTopology(data, { modeX: mode })
        expect(plan.maxColumn).toEqual(maxX)
        expect([...plan.nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
      }
    )

    each([
      [
        '1x2 circular variant',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'a' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
        ],
        1,
      ],
      [
        '1x3 circular variant',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
          { flow: 1, from: 'c', to: 'a' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
        ],
        2,
      ],
      [
        '3x1,2x1 circular',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
          { flow: 1, from: 'd', to: 'b' },
          { flow: 1, from: 'd', to: 'e' },
          { flow: 1, from: 'e', to: 'c' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
          { key: 'd', x: 0 },
          { key: 'e', x: 1 },
        ],
        2,
      ],
      [
        '3x1,2x1 circular variant',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
          { flow: 1, from: 'd', to: 'b' },
          { flow: 1, from: 'e', to: 'c' },
          { flow: 1, from: 'd', to: 'e' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
          { key: 'd', x: 0 },
          { key: 'e', x: 1 },
        ],
        2,
      ],
      [
        'complex circular',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
          { flow: 1, from: 'b', to: 'd' },
          { flow: 1, from: 'c', to: 'c' },
          { flow: 1, from: 'd', to: 'e' },
          { flow: 1, from: 'e', to: 'b' },
        ],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
          { key: 'd', x: 2 },
          { key: 'e', x: 3 },
        ],
        3,
      ],
      [
        'complex circular 2',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'b', to: 'c' },
          { flow: 1, from: 'b', to: 'd' },
          { flow: 1, from: 'c', to: 'd' },
          { flow: 1, from: 'd', to: 'e' },
          { flow: 1, from: 'f', to: 'c' },
        ],
        'edge' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 2 },
          { key: 'd', x: 3 },
          { key: 'e', x: 4 },
          { key: 'f', x: 0 },
        ],
        4,
      ],
    ])(
      'should map nodes with circular flows to columns: %p',
      (_test, data, mode, expected, maxX) => {
        const plan = buildTopology(data, { modeX: mode })
        expect(plan.maxColumn).toEqual(maxX)
        expect([...plan.nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
      }
    )

    each([
      [
        '2x2 circular variant',
        [
          { flow: 1, from: 'a', to: 'b' },
          { flow: 1, from: 'c', to: 'd' },
          { flow: 1, from: 'd', to: 'c' },
        ],
        'even' as const,
        [
          { key: 'a', x: 0 },
          { key: 'b', x: 1 },
          { key: 'c', x: 0 },
          { key: 'd', x: 1 },
        ],
        1,
      ],
    ])(
      'should map nodes with multiple entries and circular flows to columns: %p',
      (_test, data, mode, expected, maxX) => {
        const plan = buildTopology(data, { modeX: mode })
        expect(plan.maxColumn).toEqual(maxX)
        expect([...plan.nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
      }
    )
  })

  describe('back flows', () => {
    it('picks the smallest flow of a ring', () => {
      const { back } = columnsOf([
        { flow: 10, from: 'A', to: 'B' },
        { flow: 8, from: 'B', to: 'C' },
        { flow: 6, from: 'C', to: 'A' },
      ])
      expect(back).toEqual([2])
    })

    it('does not depend on data order for different flows', () => {
      const data = [
        { flow: 6, from: 'C', to: 'A' },
        { flow: 10, from: 'A', to: 'B' },
        { flow: 8, from: 'B', to: 'C' },
      ]
      const { back, plan } = columnsOf(data)
      expect(back).toEqual([0])
      expect([...plan.nodes.values()].map((n) => [n.key, n.x])).toEqual([
        ['C', 2],
        ['A', 0],
        ['B', 1],
      ])
    })

    it('breaks ties by data order', () => {
      expect(
        columnsOf([
          { flow: 1, from: 'A', to: 'B' },
          { flow: 1, from: 'B', to: 'A' },
        ]).back
      ).toEqual([1])
    })

    it('treats a self flow as a back flow', () => {
      expect(columnsOf([{ flow: 1, from: 'A', to: 'A' }]).back).toEqual([0])
    })

    it('classifies a flow between nodes pinned to one column as a back flow', () => {
      const { back, plan } = columnsOf(
        [
          { flow: 5, from: 'A', to: 'B' },
          { flow: 3, from: 'B', to: 'C' },
        ],
        { column: { B: 1, C: 1 } }
      )
      expect(back).toEqual([1])
      expect(plan.maxColumn).toBe(1)
    })

    it('terminates on a large dense cyclic graph', () => {
      const data = []
      for (let i = 0; i < 60; i++) {
        for (let j = 0; j < 60; j++) {
          if (i !== j && (i * 7 + j * 3) % 5 === 0)
            data.push({ flow: 1 + ((i + j) % 9), from: `n${i}`, to: `n${j}` })
        }
      }
      const { plan } = columnsOf(data)
      const forward = plan.links.filter((l) => !l.back)
      expect(forward.every((l) => (l.from.x as number) < (l.to.x as number))).toBe(true)
    })
  })

  describe('order and ports', () => {
    const data = [
      { flow: 4, from: 'A', to: 'C' },
      { flow: 6, from: 'B', to: 'C' },
      { flow: 3, from: 'C', to: 'D' },
      { flow: 7, from: 'C', to: 'E' },
      { flow: 2, from: 'E', to: 'A' },
    ]

    it('lists every node once, in its own column', () => {
      const { plan } = columnsOf(data)
      const keys = nodesByColumn(plan)
        .flatMap((c) => c.map((n) => n.key))
        .sort()
      expect(keys).toEqual(['A', 'B', 'C', 'D', 'E'])
      nodesByColumn(plan).forEach((column, x) => {
        for (const node of column) expect(node.x).toBe(x)
      })
    })

    it('follows priority within a column', () => {
      const { plan } = columnsOf(data, { priority: { A: 2, B: 1 } })
      expect(nodesByColumn(plan)[0].map((n) => n.key)).toEqual(['B', 'A'])
    })
  })

  describe('waypoints', () => {
    const skipping = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 10, from: 'B', to: 'C' },
      { flow: 10, from: 'C', to: 'D' },
      { flow: 6, from: 'A', to: 'D' },
    ]

    it('gives a skipping flow a waypoint in every column it skips', () => {
      const { plan } = columnsOf(skipping)
      const link = plan.links[3]
      expect(link.path.map((s) => s.key)).toEqual(['A', '3@1', '3@2', 'D'])
      expect(link.path.slice(1, -1).every((s) => s.size === 6 && !s.node)).toBe(true)
      expect(plan.links[0].path).toHaveLength(2)
    })

    it('keeps waypoints out of the nodes and puts them in the slots of the column', () => {
      const { plan } = columnsOf(skipping)
      expect(
        nodesByColumn(plan)
          .flat()
          .map((n) => n.key)
          .sort()
      ).toEqual(['A', 'B', 'C', 'D'])
      expect(plan.slots[1].map((s) => s.key).sort()).toEqual(['3@1', 'B'])
      expect(plan.slots.flat()).toHaveLength(6)
    })

    it('gives back flows no waypoints', () => {
      const { plan } = columnsOf([...skipping, { flow: 1, from: 'D', to: 'A' }])
      expect(plan.links[4].back).toBe(true)
      expect(plan.links[4].path).toHaveLength(2)
    })

    it('orders the ports by the position of the other end in the next column', () => {
      const { plan } = columnsOf(skipping)
      const a = slotOf(plan, 'A')
      const ends = a?.out.map((l) => l.path[1].key)
      const positions = ends?.map((key) => plan.slots[1].findIndex((s) => s.key === key))
      expect(positions).toEqual([...(positions ?? [])].sort((x, y) => x - y))
    })

    it('follows priority for the nodes of a column', () => {
      const { plan } = columnsOf(
        [
          { flow: 5, from: 'A', to: 'C' },
          { flow: 5, from: 'B', to: 'D' },
        ],
        { priority: { A: 2, B: 1 } }
      )
      expect(nodesByColumn(plan)[0].map((n) => n.key)).toEqual(['B', 'A'])
    })
  })

  describe('lanes', () => {
    const ringData = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 8, from: 'B', to: 'C' },
      { flow: 6, from: 'C', to: 'A' },
    ]

    it('gives every back flow a lane spanning the columns it runs under', () => {
      const { plan } = columnsOf(ringData)
      expect(plan.links.map((l) => l.rank ?? -1)).toEqual([-1, -1, 0])
      expect(plan.loops).toHaveLength(1)
      const [lane] = plan.loops
      expect([lane.to.x, lane.from.x]).toEqual([0, 2])
      expect(lane.flow).toBe(6)
      // loops are not part of the content of the columns
      expect(
        plan.slots
          .flat()
          .map((slot) => (slot.node ? 'node' : 'waypoint'))
          .sort()
      ).toEqual(['node', 'node', 'node'])
    })

    it('routes every back flow, however many lanes that takes', () => {
      const data = [
        { flow: 1000, from: 'N0', to: 'N1' },
        { flow: 1000, from: 'N1', to: 'N2' },
        { flow: 1000, from: 'N2', to: 'N3' },
        { flow: 1000, from: 'N3', to: 'N4' },
        { flow: 1000, from: 'N4', to: 'N5' },
        ...Array.from({ length: 30 }, (_, i) => ({ flow: 1 + i, from: 'N5', to: 'N0' })),
      ]
      const { plan } = columnsOf(data, { backFlows: { bundle: false } })
      const back = plan.links.filter((l) => l.back)
      expect(back).toHaveLength(30)
      expect(back.every((l) => l.rank !== undefined)).toBe(true)
      expect(plan.loops).toHaveLength(30)
    })

    it('takes the flows between two nodes together when it picks the back flows', () => {
      // two flows A to B of 4 and 3 add up to 7, more than the 5 of B to A
      const data = [
        { flow: 4, from: 'A', to: 'B' },
        { flow: 5, from: 'B', to: 'A' },
        { flow: 3, from: 'A', to: 'B' },
      ]
      const { back } = columnsOf(data)
      expect(back).toEqual([1])
      // by size alone the 5 would have gone first, and the two A to B flows would have closed the cycle
      const alone = columnsOf([data[0], data[1]]).back
      expect(alone).toEqual([0])
    })

    it('breaks a tie between pairs by the data order', () => {
      const { back } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 5, from: 'B', to: 'A' },
      ])
      expect(back).toEqual([1])
    })

    it('leaves a flow to the node itself in a lane of its own kind of loop', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 2, from: 'B', to: 'B' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].rank).toBe(0)
    })

    it('draws a flow forward when pinned columns put its target after its source, even if it closes a cycle', () => {
      const plan = buildTopology(
        [
          { flow: 10, from: 'A', to: 'B' },
          { flow: 1, from: 'B', to: 'A' },
        ],
        { column: { A: 2, B: 0 } }
      )
      expect(plan.links.map((l) => l.back)).toEqual([true, false])
      // the forward one skips a column, through a waypoint
      expect(plan.links[1].path).toHaveLength(3)
      expect(plan.loops).toEqual([plan.links[0]])
    })

    it('gives empty flows no lane', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 0, from: 'B', to: 'A' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].rank).toBeUndefined()
      expect(plan.loops).toHaveLength(0)
    })

    it('puts the back flows of an edge after the others, the outermost lane first', () => {
      const { plan } = columnsOf([
        { flow: 10, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'C' },
        { flow: 10, from: 'C', to: 'D' },
        { flow: 3, from: 'D', to: 'C' },
        { flow: 2, from: 'D', to: 'B' },
        { flow: 9, from: 'D', to: 'E' },
      ])
      const out = slotOf(plan, 'D')?.out ?? []
      expect(out.map((l) => l.to.key)).toEqual(['E', 'B', 'C'])
      expect(out.map((l) => l.rank ?? -1)).toEqual([-1, 1, 0])
    })

    it('does not let a back flow pull its nodes together when ordering', () => {
      const withBack = columnsOf([
        { flow: 5, from: 'A', to: 'C' },
        { flow: 4, from: 'B', to: 'D' },
        { flow: 1, from: 'C', to: 'A' },
        { flow: 1, from: 'D', to: 'B' },
      ]).plan
      const without = columnsOf([
        { flow: 5, from: 'A', to: 'C' },
        { flow: 4, from: 'B', to: 'D' },
      ]).plan
      expect(nodesByColumn(withBack).map((c) => c.map((n) => n.key))).toEqual(
        nodesByColumn(without).map((c) => c.map((n) => n.key))
      )
    })

    it('leaves the links of the nodes as they were', () => {
      const { plan } = columnsOf(ringData)
      const c = plan.nodes.get('C')
      expect(c?.to.map((e) => e.key)).toEqual(['A'])
      expect(plan.nodes.get('A')?.from.map((e) => e.key)).toEqual(['C'])
    })
  })
})
