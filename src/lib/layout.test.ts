import type { SankeyNode } from '../types.js'

import { buildNodesFromData } from './core.js'
import { addPadding, calculateX, layout, returnsToNearerColumn } from './layout.js'

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

describe('lib/layout', () => {
  describe('returnsToNearerColumn', () => {
    const nodeAt = (x: number) => ({ x }) as SankeyNode

    it('returns false without a following node', () => {
      expect(returnsToNearerColumn(nodeAt(2))).toBeFalse()
    })

    it('returns false for a node in the same column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(2))).toBeFalse()
    })

    it('returns false for a node in a farther column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(3))).toBeFalse()
    })

    it('returns true for a node in a nearer column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(1))).toBeTrue()
    })
  })

  it('does not offset an intermediate node by unrelated inputs of a direct target', () => {
    const data = [
      { flow: 80, from: 'Visits', to: 'Product views' },
      { flow: 20, from: 'Visits', to: 'Exit' },
      { flow: 32, from: 'Product views', to: 'Cart' },
      { flow: 48, from: 'Product views', to: 'Exit' },
      { flow: 18, from: 'Cart', to: 'Purchase' },
      { flow: 14, from: 'Cart', to: 'Abandoned' },
    ]
    const nodes = buildNodesFromData(data, {})

    layout(nodes, data, { height: 100, modeX: 'edge', nodePadding: 0, priority: false })

    expect(nodes.get('Product views')?.y).toBe(20)
  })

  describe('calculateX', () => {
    it('should work with empty chart', () => {
      expect(calculateX(new Map(), [], 'edge')).toEqual(0)
      expect(calculateX(new Map(), [], 'even')).toEqual(0)
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
      const nodes = buildNodesFromData(data, {})
      expect(calculateX(nodes, data, mode)).toEqual(maxX)
      expect([...nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
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
        const nodes = buildNodesFromData(data, {})
        expect(calculateX(nodes, data, mode)).toEqual(maxX)
        expect([...nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
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
        const nodes = buildNodesFromData(data, {})
        expect(calculateX(nodes, data, mode)).toEqual(maxX)
        expect([...nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
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
        const nodes = buildNodesFromData(data, {})
        expect(calculateX(nodes, data, mode)).toEqual(maxX)
        expect([...nodes.values()].map(({ key, x }) => ({ key, x }))).toEqual(expected)
      }
    )
  })
  describe('addPadding', () => {
    it('when there is a single row of nodes, it should not add any paddings', () => {
      const nodes = [
        { in: 0, out: 8, size: 8, x: 0, y: 0 },
        { in: 8, out: 10, size: 10, x: 1, y: 0 },
        { in: 10, out: 0, size: 10, x: 2, y: 0 },
      ]

      // maxY equals max flow
      expect(addPadding(nodes, 5)).toEqual(10)

      // no changes
      expect(nodes.map((node) => node.y)).toEqual([0, 0, 0])
    })

    it('when there are multiple rows of nodes, it should add paddings', () => {
      const nodes = [
        { in: 0, out: 8, size: 8, x: 0, y: 0 },
        { in: 0, out: 5, size: 5, x: 0, y: 8 },
        { in: 0, out: 5, size: 5, x: 0, y: 13 },
        { in: 13, out: 0, size: 13, x: 1, y: 0 },
        { in: 5, out: 0, size: 5, x: 1, y: 13 },
      ]

      // 18 + 2x padding
      expect(addPadding(nodes, 1)).toEqual(20)

      // padding added to 2 nodes @x=0 and 1 node @x=1
      expect(nodes.map((node) => node.y)).toEqual([0, 9, 15, 0, 15])
    })

    it('it should consider previous columns, when node has input', () => {
      const nodes = [
        { in: 0, out: 1, size: 1, x: 0, y: 0 },
        { in: 0, out: 1, size: 1, x: 0, y: 1 },
        { in: 0, out: 1, size: 1, x: 0, y: 2 },
        { in: 0, out: 1, size: 1, x: 0, y: 3 },

        { in: 0, out: 1, size: 1, x: 1, y: 4 },

        { in: 3, out: 3, size: 3, x: 2, y: 0 },
        { in: 2, out: 2, size: 2, x: 2, y: 2 },

        { in: 1, out: 0, size: 1, x: 3, y: 0 },
        { in: 1, out: 0, size: 1, x: 3, y: 1 },
        { in: 1, out: 0, size: 1, x: 3, y: 2 },
        { in: 1, out: 0, size: 1, x: 3, y: 3 },
        { in: 1, out: 0, size: 1, x: 3, y: 4 },
      ]

      // 5 + 4x padding
      expect(addPadding(nodes, 1)).toEqual(9)

      expect(nodes.filter((node) => node.x === 0).map((node) => node.y)).toEqual([0, 2, 4, 6])
      expect(nodes.filter((node) => node.x === 1).map((node) => node.y)).toEqual([5])
      expect(nodes.filter((node) => node.x === 2).map((node) => node.y)).toEqual([0, 4])
      expect(nodes.filter((node) => node.x === 3).map((node) => node.y)).toEqual([0, 2, 4, 6, 8])
    })
  })
})
