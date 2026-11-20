import { buildTopology, sidesOf } from './topology.js'

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
      const keys = plan.columns.flatMap((c) => c.map((n) => n.key)).sort()
      expect(keys).toEqual(['A', 'B', 'C', 'D', 'E'])
      plan.columns.forEach((column, x) => {
        for (const node of column) expect(node.x).toBe(x)
      })
    })

    it('freezes the plan', () => {
      const { plan } = columnsOf(data)
      expect(Object.isFrozen(plan)).toBe(true)
      expect(Object.isFrozen(plan.links)).toBe(true)
      expect(Object.isFrozen(plan.columns[0])).toBe(true)
    })

    it('follows priority within a column', () => {
      const { plan } = columnsOf(data, { priority: { A: 2, B: 1 } })
      expect(plan.columns[0].map((n) => n.key)).toEqual(['B', 'A'])
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
        plan.columns
          .flat()
          .map((n) => n.key)
          .sort()
      ).toEqual(['A', 'B', 'C', 'D'])
      expect(plan.slots[1].map((s) => s.key).sort()).toEqual(['3@1', 'B'])
      expect(plan.slots.flat()).toHaveLength(6)
    })

    it('gives back flows loop slots, not waypoints', () => {
      const { plan } = columnsOf([...skipping, { flow: 1, from: 'D', to: 'A' }])
      expect(plan.links[4].back).toBe(true)
      expect(plan.links[4].path.map((s) => s.kind)).toEqual([
        'node',
        'loop',
        'loop',
        'loop',
        'loop',
        'node',
      ])
    })

    it('orders the ports by the position of the other end in the next column', () => {
      const { plan } = columnsOf(skipping)
      const a = plan.nodeSlots.get('A')
      const ends = a?.right.map((stop) => stop.link.path[1].key)
      const positions = ends?.map((key) => plan.slots[1].findIndex((s) => s.key === key))
      expect(positions).toEqual([...(positions ?? [])].sort((x, y) => x - y))
    })

    it('keeps the plan frozen', () => {
      const { plan } = columnsOf(skipping)
      expect(Object.isFrozen(plan.slots[1])).toBe(true)
      expect(Object.isFrozen(plan.links[3].path)).toBe(true)
      expect(Object.isFrozen(plan.nodeSlots.get('A'))).toBe(true)
    })

    it('follows priority for the nodes of a column', () => {
      const { plan } = columnsOf(
        [
          { flow: 5, from: 'A', to: 'C' },
          { flow: 5, from: 'B', to: 'D' },
        ],
        { priority: { A: 2, B: 1 } }
      )
      expect(plan.columns[0].map((n) => n.key)).toEqual(['B', 'A'])
    })
  })

  describe('loops', () => {
    const ringData = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 8, from: 'B', to: 'C' },
      { flow: 6, from: 'C', to: 'A' },
    ]

    it('gives a back flow a loop slot in the column of its source, of its target and of every one between', () => {
      const { plan } = columnsOf(ringData)
      const back = plan.links[2]
      expect(back.path.map((s) => s.key)).toEqual(['C', '2@2', '2@1', '2@0', 'A'])
      expect(back.path.slice(1, -1).every((s) => s.kind === 'loop' && s.size === 6)).toBe(true)
      // a loop slot is a slot of its column but no node
      expect(plan.slots.map((column) => column.length)).toEqual([2, 2, 2])
      expect(plan.columns.map((column) => column.length)).toEqual([1, 1, 1])
    })

    it('gives a back flow two turns, beside its source column and beside its target column', () => {
      const { plan } = columnsOf(ringData)
      expect(plan.hooks.map((h) => [h.node.key, h.slot.key, h.side, h.column])).toEqual([
        ['C', '2@2', 'right', 2],
        ['A', '2@0', 'left', 0],
      ])
    })

    it('puts the flows of a slot on the edge they meet, the loop slots from right to left', () => {
      const { plan } = columnsOf(ringData)
      const slot = plan.slots[1].find((s) => s.key === '2@1')
      expect(slot?.right.map((stop) => stop.link.index)).toEqual([2])
      expect(slot?.left.map((stop) => stop.link.index)).toEqual([2])
      expect(sidesOf(plan.links[2], 0)).toEqual({ arrive: undefined, leave: 'right' })
      expect(sidesOf(plan.links[2], 1)).toEqual({ arrive: 'right', leave: 'left' })
      expect(sidesOf(plan.links[2], 4)).toEqual({ arrive: 'left', leave: undefined })
      expect(sidesOf(plan.links[0], 1)).toEqual({ arrive: 'left', leave: undefined })
    })

    it('gives every back flow its slots, however many there are', () => {
      const data = [
        { flow: 100, from: 'N0', to: 'N1' },
        { flow: 100, from: 'N1', to: 'N2' },
        { flow: 100, from: 'N2', to: 'N3' },
        { flow: 100, from: 'N3', to: 'N4' },
        { flow: 100, from: 'N4', to: 'N5' },
        ...Array.from({ length: 30 }, (_, i) => ({ flow: 1 + i, from: 'N5', to: 'N0' })),
      ]
      const { plan } = columnsOf(data)
      const back = plan.links.filter((l) => l.back)
      expect(back).toHaveLength(30)
      expect(back.every((l) => l.path.length === 8)).toBe(true)
      expect(plan.hooks).toHaveLength(60)
    })

    it('gives a flow to the node itself one slot, with both turns', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 2, from: 'B', to: 'B' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].path.map((s) => s.key)).toEqual(['B', '1@1', 'B'])
      expect(plan.hooks.map((h) => [h.slot.key, h.side])).toEqual([
        ['1@1', 'right'],
        ['1@1', 'left'],
      ])
    })

    it('gives empty flows no slots', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 0, from: 'B', to: 'A' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].path).toHaveLength(2)
      expect(plan.hooks).toHaveLength(0)
    })

    it('keeps the turns of a node edge nested and clear of the flows between the columns', () => {
      const { plan } = columnsOf([
        { flow: 10, from: 'A', to: 'B' },
        { flow: 10, from: 'B', to: 'C' },
        { flow: 10, from: 'C', to: 'D' },
        { flow: 3, from: 'D', to: 'C' },
        { flow: 2, from: 'D', to: 'B' },
        { flow: 9, from: 'D', to: 'E' },
      ])
      const slot = plan.nodeSlots.get('D')
      const column = plan.slots[3]
      const at = (key: string) => column.findIndex((s) => s.key === key)
      const mine = column.indexOf(slot as never)
      // the other end of each stop: a loop slot of the column above or below the node, or the next column
      const stops = (slot?.right ?? []).map((stop) => {
        const other = stop.link.path[stop.at + 1]
        return other.column === 3 ? (at(other.key) < mine ? 'above' : 'below') : 'between'
      })
      const groups = ['above', 'between', 'below']
      expect(stops.map((g) => groups.indexOf(g))).toEqual(
        [...stops.map((g) => groups.indexOf(g))].sort((x, y) => x - y)
      )
      expect(stops.filter((g) => g === 'between')).toHaveLength(1)
    })

    it('leaves the links of the nodes as they were', () => {
      const { plan } = columnsOf(ringData)
      const c = plan.nodes.get('C')
      expect(c?.to.map((e) => e.key)).toEqual(['A'])
      expect(plan.nodes.get('A')?.from.map((e) => e.key)).toEqual(['C'])
    })
  })
})
