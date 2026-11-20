import { addPadding } from './layout.js'

describe('lib/layout', () => {
  describe('addPadding', () => {
    // Builds a gaps map that reproduces the old single-number `padding`
    // behavior: before === after === p for every node, so adjacent gaps
    // collapse to exactly p (max(p, p) === p), matching the pre-per-node-gap
    // algorithm byte for byte.
    function uniformGaps(
      keys: string[],
      p: number
    ): Map<string, { after: number; before: number }> {
      return new Map(keys.map((key) => [key, { after: p, before: p }]))
    }

    it('when there is a single row of nodes, it should not add any paddings', () => {
      const nodes = [
        { in: 0, key: 'a', out: 8, size: 8, x: 0, y: 0 },
        { in: 8, key: 'b', out: 10, size: 10, x: 1, y: 0 },
        { in: 10, key: 'c', out: 0, size: 10, x: 2, y: 0 },
      ]

      // maxY equals max flow
      expect(addPadding(nodes, uniformGaps(['a', 'b', 'c'], 5))).toEqual(10)

      // no changes
      expect(nodes.map((node) => node.y)).toEqual([0, 0, 0])
    })

    it('when there are multiple rows of nodes, it should add paddings (uniform gaps match the pre-per-node-gap result)', () => {
      const nodes = [
        { in: 0, key: 'a', out: 8, size: 8, x: 0, y: 0 },
        { in: 0, key: 'b', out: 5, size: 5, x: 0, y: 8 },
        { in: 0, key: 'c', out: 5, size: 5, x: 0, y: 13 },
        { in: 13, key: 'd', out: 0, size: 13, x: 1, y: 0 },
        { in: 5, key: 'e', out: 0, size: 5, x: 1, y: 13 },
      ]

      // 18 + 2x padding, same as when addPadding took a single `padding: 1` number
      expect(addPadding(nodes, uniformGaps(['a', 'b', 'c', 'd', 'e'], 1))).toEqual(20)

      // padding added to 2 nodes @x=0 and 1 node @x=1 -- identical y series to
      // the pre-per-node-gap implementation
      expect(nodes.map((node) => node.y)).toEqual([0, 9, 15, 0, 15])
    })

    it('it should consider previous columns, when node has input (uniform gaps match the pre-per-node-gap result)', () => {
      const nodes = [
        { in: 0, key: 'a0', out: 1, size: 1, x: 0, y: 0 },
        { in: 0, key: 'a1', out: 1, size: 1, x: 0, y: 1 },
        { in: 0, key: 'a2', out: 1, size: 1, x: 0, y: 2 },
        { in: 0, key: 'a3', out: 1, size: 1, x: 0, y: 3 },

        { in: 0, key: 'b0', out: 1, size: 1, x: 1, y: 4 },

        { in: 3, key: 'c0', out: 3, size: 3, x: 2, y: 0 },
        { in: 2, key: 'c1', out: 2, size: 2, x: 2, y: 2 },

        { in: 1, key: 'd0', out: 0, size: 1, x: 3, y: 0 },
        { in: 1, key: 'd1', out: 0, size: 1, x: 3, y: 1 },
        { in: 1, key: 'd2', out: 0, size: 1, x: 3, y: 2 },
        { in: 1, key: 'd3', out: 0, size: 1, x: 3, y: 3 },
        { in: 1, key: 'd4', out: 0, size: 1, x: 3, y: 4 },
      ]
      const keys = nodes.map((node) => node.key)

      // 5 + 4x padding, same as when addPadding took a single `padding: 1` number
      expect(addPadding(nodes, uniformGaps(keys, 1))).toEqual(9)

      // identical y series to the pre-per-node-gap implementation
      expect(nodes.filter((node) => node.x === 0).map((node) => node.y)).toEqual([0, 2, 4, 6])
      expect(nodes.filter((node) => node.x === 1).map((node) => node.y)).toEqual([5])
      expect(nodes.filter((node) => node.x === 2).map((node) => node.y)).toEqual([0, 4])
      expect(nodes.filter((node) => node.x === 3).map((node) => node.y)).toEqual([0, 2, 4, 6, 8])
    })

    it('collapses adjacent gaps like CSS margins, using the larger of prev.after and next.before', () => {
      const nodes = [
        { in: 0, key: 'top', out: 1, size: 1, x: 0, y: 0 },
        { in: 0, key: 'bottom', out: 1, size: 1, x: 0, y: 5 },
      ]
      const gaps = new Map([
        ['top', { after: 20, before: 0 }],
        ['bottom', { after: 0, before: 6 }],
      ])

      addPadding(nodes, gaps)

      // max(20, 6) === 20, not 20 + 6 === 26
      expect(nodes[1].y).toEqual(25)
    })

    it('uses a node’s own before value for virtual cross-column levels it does not share a real neighbor for', () => {
      // Same shape as the "previous columns" case above, but c1's own column
      // has only 1 real node above it (c0) while its inputs (column x=0)
      // demand 2 levels of padding. The extra (virtual) level must be valued
      // using c1's own `before`, not a value borrowed from c0 or from column
      // x=0.
      const nodes = [
        { in: 0, key: 'a0', out: 1, size: 1, x: 0, y: 0 },
        { in: 0, key: 'a1', out: 1, size: 1, x: 0, y: 1 },
        { in: 0, key: 'a2', out: 1, size: 1, x: 0, y: 2 },
        { in: 0, key: 'a3', out: 1, size: 1, x: 0, y: 3 },

        { in: 3, key: 'c0', out: 3, size: 3, x: 2, y: 0 },
        { in: 2, key: 'c1', out: 2, size: 2, x: 2, y: 2 },
      ]
      const gaps = new Map([
        ['a0', { after: 1, before: 1 }],
        ['a1', { after: 1, before: 1 }],
        ['a2', { after: 1, before: 1 }],
        ['a3', { after: 1, before: 1 }],
        ['c0', { after: 1, before: 1 }],
        // c1 has no real neighbor in its own column (only c0 sits above it,
        // and the transition into it is m=1). Its 1 virtual level (k=2, m=1)
        // must use c1's own before, here deliberately different from 1.
        ['c1', { after: 1, before: 100 }],
      ])

      addPadding(nodes, gaps)

      // real part: max(c0.after=1, c1.before=100) = 100; virtual part: 1*100
      expect(nodes.find((node) => node.key === 'c1')?.y).toEqual(2 + 100 + 100)
    })

    describe('even mode', () => {
      it('gives every gap in a column the exact requested size, regardless of node size', () => {
        // Three differently sized nodes stacked in the same column. In
        // 'even' mode the gap between adjacent nodes never depends on
        // either node's size -- only on the requested gap itself.
        const nodes = [
          { in: 0, key: 'a', out: 5, size: 5, x: 0, y: 0 },
          { in: 0, key: 'b', out: 3, size: 3, x: 0, y: 1 },
          { in: 0, key: 'c', out: 8, size: 8, x: 0, y: 2 },
        ]

        addPadding(nodes, uniformGaps(['a', 'b', 'c'], 4), 1, 'even')

        // topmost node keeps its y; each of the following nodes sits
        // exactly size(prev) + gap below the previous one
        expect(nodes.map((node) => node.y)).toEqual([0, 9, 16])
        expect(nodes[1].y - (nodes[0].y + nodes[0].size)).toBe(4)
        expect(nodes[2].y - (nodes[1].y + nodes[1].size)).toBe(4)
      })

      it('uses max(prev.after, next.before) for each gap, same collapsing rule as auto mode', () => {
        const nodes = [
          { in: 0, key: 'a', out: 4, size: 4, x: 0, y: 0 },
          { in: 0, key: 'b', out: 2, size: 2, x: 0, y: 1 },
          { in: 0, key: 'c', out: 1, size: 1, x: 0, y: 2 },
        ]
        const gaps = new Map([
          ['a', { after: 2, before: 0 }],
          ['b', { after: 6, before: 10 }],
          ['c', { after: 0, before: 3 }],
        ])

        addPadding(nodes, gaps, 1, 'even')

        expect(nodes[0].y).toBe(0)
        // 0 + a.size(4) + max(a.after=2, b.before=10) = 14
        expect(nodes[1].y).toBe(14)
        // 14 + b.size(2) + max(b.after=6, c.before=3) = 22
        expect(nodes[2].y).toBe(22)
      })

      it('gives a node exactly one gap, where auto inflates it with virtual cross-column levels', () => {
        // Same shape as the cross-column test above: c1's own column has
        // only c0 as a real neighbor, but its inputs (column x=0) demand 2
        // padding levels. 'auto' honors that cross-column requirement and
        // adds a second, virtual gap; 'even' ignores cross-column levels
        // entirely and gives c1 a single real gap below c0.
        const nodes = [
          { in: 0, key: 'a0', out: 1, size: 1, x: 0, y: 0 },
          { in: 0, key: 'a1', out: 1, size: 1, x: 0, y: 1 },
          { in: 0, key: 'a2', out: 1, size: 1, x: 0, y: 2 },
          { in: 0, key: 'a3', out: 1, size: 1, x: 0, y: 3 },

          { in: 3, key: 'c0', out: 3, size: 3, x: 2, y: 0 },
          { in: 2, key: 'c1', out: 2, size: 2, x: 2, y: 2 },
        ]
        const gaps = new Map([
          ['a0', { after: 1, before: 1 }],
          ['a1', { after: 1, before: 1 }],
          ['a2', { after: 1, before: 1 }],
          ['a3', { after: 1, before: 1 }],
          ['c0', { after: 1, before: 1 }],
          ['c1', { after: 1, before: 100 }],
        ])

        const autoNodes = nodes.map((node) => ({ ...node }))
        addPadding(autoNodes, gaps)
        expect(autoNodes.find((node) => node.key === 'c1')?.y).toBe(202)

        const evenNodes = nodes.map((node) => ({ ...node }))
        addPadding(evenNodes, gaps, 1, 'even')
        // c0.y(0) + c0.size(3) + max(c0.after=1, c1.before=100) = 103 -- a
        // single gap, not the two levels 'auto' adds above.
        expect(evenNodes.find((node) => node.key === 'c1')?.y).toBe(103)
      })
    })

    describe('nodeMinSize', () => {
      // The drawn bar is stretched (see getNodeRect in controller.ts) to
      // max(node.size, nodeMinSize * scale), symmetrically around the node's
      // real position -- half the stretch above/left, half below/right.
      // These helpers recompute that visual span from the same inputs
      // addPadding takes, so a test can assert on it without duplicating
      // production code.
      function visualBottom(
        node: { key: string; size: number; y?: number },
        minSizes: Map<string, number>
      ): number {
        const minSizeUnits = minSizes.get(node.key) ?? 0
        const height = Math.max(node.size, minSizeUnits)
        return (node.y ?? 0) + (node.size + height) / 2
      }

      function visualTop(
        node: { key: string; size: number; y?: number },
        minSizes: Map<string, number>
      ): number {
        const minSizeUnits = minSizes.get(node.key) ?? 0
        const height = Math.max(node.size, minSizeUnits)
        return (node.y ?? 0) + (node.size - height) / 2
      }

      it('auto mode: reserves enough room that a minSize far larger than either node keeps the requested gap between the stretched bars', () => {
        const nodes = [
          { in: 0, key: 'a', out: 2, size: 2, x: 0, y: 0 },
          { in: 0, key: 'b', out: 3, size: 3, x: 0, y: 2 },
        ]
        // Both minimums are far bigger than either node's natural size (2, 3)
        // or their sum (5).
        const minSizes = new Map([
          ['a', 20],
          ['b', 20],
        ])

        addPadding(nodes, uniformGaps(['a', 'b'], 4), 1, 'auto', minSizes)

        const gapBetweenBars = visualTop(nodes[1], minSizes) - visualBottom(nodes[0], minSizes)
        expect(gapBetweenBars).toBeGreaterThanOrEqual(4)
        // The stretch is accounted for exactly, not just conservatively.
        expect(gapBetweenBars).toBeCloseTo(4, 9)
      })

      it('auto mode: grows maxY to cover the stretched bar', () => {
        const withoutMinSize = [{ in: 0, key: 'a', out: 5, size: 5, x: 0, y: 0 }]
        const withMinSize = [{ in: 0, key: 'a', out: 5, size: 5, x: 0, y: 0 }]

        const baseMaxY = addPadding(withoutMinSize, uniformGaps(['a'], 0))
        const stretchedMaxY = addPadding(
          withMinSize,
          uniformGaps(['a'], 0),
          1,
          'auto',
          new Map([['a', 50]])
        )

        expect(baseMaxY).toBe(5)
        // Visual bottom of the stretched bar: y + (size + minSize) / 2
        expect(stretchedMaxY).toBeCloseTo(27.5, 9)
        expect(stretchedMaxY).toBeGreaterThan(baseMaxY)
      })

      it('minSize: 0 (the default, an empty map) changes nothing', () => {
        const withDefault = [
          { in: 0, key: 'a', out: 8, size: 8, x: 0, y: 0 },
          { in: 0, key: 'b', out: 5, size: 5, x: 0, y: 8 },
        ]
        const withExplicitZero = withDefault.map((node) => ({ ...node }))

        const maxYDefault = addPadding(withDefault, uniformGaps(['a', 'b'], 5))
        const maxYZero = addPadding(
          withExplicitZero,
          uniformGaps(['a', 'b'], 5),
          1,
          'auto',
          new Map([
            ['a', 0],
            ['b', 0],
          ])
        )

        expect(maxYZero).toBe(maxYDefault)
        expect(withExplicitZero.map((node) => node.y)).toEqual(withDefault.map((node) => node.y))
      })

      it('even mode: keeps the requested gap between stretched bars the same way auto mode does', () => {
        const nodes = [
          { in: 0, key: 'a', out: 5, size: 5, x: 0, y: 0 },
          { in: 0, key: 'b', out: 3, size: 3, x: 0, y: 1 },
        ]
        const minSizes = new Map([
          ['a', 20],
          ['b', 20],
        ])

        const maxY = addPadding(nodes, uniformGaps(['a', 'b'], 4), 1, 'even', minSizes)

        const gapBetweenBars = visualTop(nodes[1], minSizes) - visualBottom(nodes[0], minSizes)
        expect(gapBetweenBars).toBeCloseTo(4, 9)

        // maxY covers b's stretched bar, not just its natural in/out.
        expect(maxY).toBeCloseTo(visualBottom(nodes[1], minSizes), 9)
        expect(maxY).toBeGreaterThan(nodes[1].y + Math.max(nodes[1].in, nodes[1].out))
      })
    })
  })
})
