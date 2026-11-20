import { buildTopology } from './topology.js'

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

    it('orders the ports by the other end and puts back flows last', () => {
      const { plan } = columnsOf(data)
      const a = plan.ports.get('A')
      expect(a?.in.map((l) => l.index)).toEqual([4])
      expect(a?.out.map((l) => l.index)).toEqual([0])
      const c = plan.ports.get('C')
      const colA = plan.columns[0].map((n) => n.key)
      expect(c?.in.map((l) => l.from.key)).toEqual(colA)
      const e = plan.ports.get('E')
      expect(e?.out.map((l) => l.back)).toEqual([true])
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

  describe('hints from the ordering stage', () => {
    const cash = [
      { flow: 1150, from: 'division a', to: 'revenue' },
      { flow: 650, from: 'dibision b', to: 'revenue' },
      { flow: 800, from: 'revenue', to: 'cost of sales' },
      { flow: 1000, from: 'revenue', to: 'cross profit' },
      { flow: 650, from: 'cross profit', to: 'operating expenses' },
      { flow: 350, from: 'cross profit', to: 'operating profit' },
    ]

    it('gives packed columns no offset and a node below a skipped one its free space', () => {
      const { plan } = columnsOf(cash)
      expect(plan.offsets.get('division a')).toBe(0)
      expect(plan.offsets.get('dibision b')).toBe(0)
      expect(plan.offsets.get('cross profit')).toBe(800)
    })

    it('asks for a gap level where a node has to clear nodes of the columns to its left', () => {
      const { plan } = columnsOf(cash)
      expect(plan.levels.get('cross profit')).toBe(1)
      expect(plan.levels.get('revenue')).toBeUndefined()
    })

    it('orders the flows of an edge by the position of the other end', () => {
      const { plan } = columnsOf(
        [
          { flow: 10, from: 'A', to: 'C' },
          { flow: 5, from: 'A', to: 'B' },
          { flow: 5, from: 'B', to: 'C' },
        ],
        {}
      )
      // C is above B in the column after the skipped one, so A's flow to C goes first
      const out = plan.ports.get('A')?.out.map((l) => l.to.key)
      expect(out).toEqual(['C', 'B'])
    })
  })

  describe('lanes', () => {
    const ringData = [
      { flow: 10, from: 'A', to: 'B' },
      { flow: 8, from: 'B', to: 'C' },
      { flow: 6, from: 'C', to: 'A' },
    ]

    it('gives every back flow a lane and the others none', () => {
      const { plan } = columnsOf(ringData)
      expect(plan.links.map((l) => l.lane)).toEqual([-1, -1, 0])
      expect(plan.lanes).toHaveLength(1)
      expect(plan.lanes[0].thickness).toBe(6)
      expect(plan.lanes[0].links.map((l) => l.index)).toEqual([2])
    })

    it('routes every back flow, however many lanes that takes', () => {
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
      expect(back.every((l) => l.lane >= 0)).toBe(true)
      expect(plan.lanes).toHaveLength(30)
    })

    it('leaves a flow to the node itself in a lane of its own kind of loop', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 2, from: 'B', to: 'B' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].lane).toBe(0)
    })

    it('gives empty flows no lane', () => {
      const { plan } = columnsOf([
        { flow: 5, from: 'A', to: 'B' },
        { flow: 0, from: 'B', to: 'A' },
      ])
      expect(plan.links[1].back).toBe(true)
      expect(plan.links[1].lane).toBe(-1)
      expect(plan.lanes).toHaveLength(0)
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
      const out = plan.ports.get('D')?.out ?? []
      expect(out.map((l) => l.to.key)).toEqual(['E', 'B', 'C'])
      expect(out.map((l) => l.lane)).toEqual([-1, 1, 0])
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
      expect(withBack.columns.map((c) => c.map((n) => n.key))).toEqual(
        without.columns.map((c) => c.map((n) => n.key))
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
