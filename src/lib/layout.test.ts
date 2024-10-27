import { describe, expect, test } from '@jest/globals'

import { addPadding } from './layout'

describe('lib/layout', () => {
  describe('addPadding', () => {
    test('when there is a single row of nodes, it should not add any paddings', () => {
      const nodes = [
        { x: 0, y: 0, in: 0, out: 8 },
        { x: 1, y: 0, in: 8, out: 10 },
        { x: 2, y: 0, in: 10, out: 0 },
      ]

      // maxY equals max flow
      expect(addPadding(nodes, 5)).toEqual(10)

      // no changes
      expect(nodes.map((node) => node.y)).toEqual([0, 0, 0])
    })

    test('when there are multiple rows of nodes, it should add paddings', () => {
      const nodes = [
        { x: 0, y: 0, in: 0, out: 8 },
        { x: 0, y: 8, in: 0, out: 5 },
        { x: 0, y: 13, in: 0, out: 5 },
        { x: 1, y: 0, in: 13, out: 0 },
        { x: 1, y: 13, in: 5, out: 0 },
      ]

      // 18 + 2x padding
      expect(addPadding(nodes, 1)).toEqual(20)

      // padding added to 2 nodes @x=0 and 1 node @x=1
      expect(nodes.map((node) => node.y)).toEqual([0, 9, 15, 0, 15])
    })

    test('it should consider previous columns, when node has input', () => {
      const nodes = [
        { x: 0, y: 0, in: 0, out: 1 },
        { x: 0, y: 1, in: 0, out: 1 },
        { x: 0, y: 2, in: 0, out: 1 },
        { x: 0, y: 3, in: 0, out: 1 },

        { x: 1, y: 4, in: 0, out: 1 },

        { x: 2, y: 0, in: 3, out: 3 },
        { x: 2, y: 2, in: 2, out: 2 },

        { x: 3, y: 0, in: 1, out: 0 },
        { x: 3, y: 1, in: 1, out: 0 },
        { x: 3, y: 2, in: 1, out: 0 },
        { x: 3, y: 3, in: 1, out: 0 },
        { x: 3, y: 4, in: 1, out: 0 },
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
