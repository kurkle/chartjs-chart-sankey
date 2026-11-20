import type { SankeyNode } from '../types.js'

import { buildNodesFromData } from './core.js'
import { calculateY, calculateYUsingPriority, nodeCount, returnsToNearerColumn } from './order.js'
import { buildTopology } from './topology.js'

function getNode(nodes: Map<string, SankeyNode>, key: string): SankeyNode {
  const node = nodes.get(key)
  if (!node) {
    throw new Error(`Test setup error: node "${key}" not found`)
  }
  return node
}

describe('lib/order', () => {
  it('does not offset an intermediate node by unrelated inputs of a direct target', () => {
    const data = [
      { flow: 80, from: 'Visits', to: 'Product views' },
      { flow: 20, from: 'Visits', to: 'Exit' },
      { flow: 32, from: 'Product views', to: 'Cart' },
      { flow: 48, from: 'Product views', to: 'Exit' },
      { flow: 18, from: 'Cart', to: 'Purchase' },
      { flow: 14, from: 'Cart', to: 'Abandoned' },
    ]
    const plan = buildTopology(data, {})
    calculateY([...plan.nodes.values()], plan.maxColumn)

    expect(plan.nodes.get('Product views')?.y).toBe(20)
  })

  it('keeps the priority layout offset through empty columns', () => {
    const data = [
      { flow: 25, from: 'Coal', to: 'Generation' },
      { flow: 18, from: 'Wind', to: 'Generation' },
      { flow: 12, from: 'Solar', to: 'Generation' },
      { flow: 20, from: 'Generation', to: 'Homes' },
      { flow: 28, from: 'Generation', to: 'Industry' },
      { flow: 7, from: 'Generation', to: 'Storage' },
    ]
    const plan = buildTopology(data, { column: { Homes: 4, Storage: 3 }, priority: {} })
    calculateYUsingPriority([...plan.nodes.values()], plan.maxColumn)

    expect(plan.nodes.get('Storage')?.y).toBe(48)
  })

  describe('returnsToNearerColumn', () => {
    const nodeAt = (x: number) => ({ x }) as SankeyNode

    it('returns false without a following node', () => {
      expect(returnsToNearerColumn(nodeAt(2))).toBe(false)
    })

    it('returns false for a node in the same column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(2))).toBe(false)
    })

    it('returns false for a node in a farther column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(3))).toBe(false)
    })

    it('returns true for a node in a nearer column', () => {
      expect(returnsToNearerColumn(nodeAt(2), nodeAt(1))).toBe(true)
    })
  })

  describe('nodeCount', () => {
    // Diamond (A -> B, A -> C, B -> D, C -> D) with a cycle back into the diamond
    // (D -> E, E -> B). B and C both flow into D, and D eventually flows back to B,
    // so a naive traversal must dedupe nodes to terminate and to avoid double counting.
    const diamondWithCycle = [
      { flow: 1, from: 'A', to: 'B' },
      { flow: 1, from: 'A', to: 'C' },
      { flow: 1, from: 'B', to: 'D' },
      { flow: 1, from: 'C', to: 'D' },
      { flow: 1, from: 'D', to: 'E' },
      { flow: 1, from: 'E', to: 'B' },
    ]

    it('counts unique downstream nodes across a diamond and a cycle', () => {
      const nodes = buildNodesFromData(diamondWithCycle, {})

      // A -> B -> D -> E -> (B, already counted) and A -> C -> (D, already counted)
      // Unique downstream nodes of A via 'to': B, C, D, E => edges counted: B.to(1) + D.to(1) +
      // E.to(1) + C.to(1) = 4
      expect(nodeCount(getNode(nodes, 'A').to, 'to')).toBe(4)
      // B -> D -> E -> (B, already counted): edges counted: D.to(1) + E.to(1) + B.to(1) = 3
      expect(nodeCount(getNode(nodes, 'B').to, 'to')).toBe(3)
      // C -> D -> E -> B -> (D, already counted): edges counted: D.to(1) + E.to(1) + B.to(1) = 3
      expect(nodeCount(getNode(nodes, 'C').to, 'to')).toBe(3)
    })

    it('returns the same result for the same list no matter how many unrelated nodeCount calls ran in between', () => {
      // Regression test for a counter that used to be shared across all nodeCount calls
      // (module-level, wrapping at 101) to mark visited nodes. In a real layout, sorting a
      // node's `from`/`to` list calls nodeCount twice per comparison, so a chart with a few
      // dozen nodes easily produces more than 101 calls in a single layout pass. When the
      // counter wrapped back to a value still stamped on a node from an earlier, unrelated
      // call, that node was wrongly treated as "already visited" and dropped from the count.
      const nodes = buildNodesFromData(
        [
          ...diamondWithCycle,
          // Unrelated filler edges that share no nodes with the diamond/cycle above. Calling
          // nodeCount on these between the assertions below advances the old module-level
          // counter without ever touching B, C, D or E.
          ...Array.from({ length: 40 }, (_, i) => ({ flow: 1, from: `F${i}`, to: `G${i}` })),
        ],
        {}
      )
      const b = getNode(nodes, 'B')
      const c = getNode(nodes, 'C')
      const fillers = Array.from({ length: 40 }, (_, i) => getNode(nodes, `F${i}`))

      const runFillers = (count: number) => {
        for (let i = 0; i < count; i++) {
          nodeCount(fillers[i % fillers.length].to, 'to')
        }
      }

      const bResults: number[] = []
      const cResults: number[] = []
      // Two full rounds of 100 unrelated calls around each probe: comfortably more than 200
      // nodeCount invocations in total, guaranteed to wrap the old 101-value counter at least
      // once between probes of the same list.
      for (let round = 0; round < 2; round++) {
        bResults.push(nodeCount(b.to, 'to'))
        runFillers(100)
        cResults.push(nodeCount(c.to, 'to'))
        runFillers(100)
      }

      expect(bResults).toEqual([3, 3])
      expect(cResults).toEqual([3, 3])
    })
  })
})
