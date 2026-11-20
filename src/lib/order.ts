import type { FromToElement, SankeyNode } from '../types.js'

import { defined } from './helpers.js'

const SMALL_VALUE = 1e-6

function nodeX(node: Pick<SankeyNode, 'x'> & { key?: string }): number {
  return node.x ?? 0
}

function nodeY(node: Pick<SankeyNode, 'y'> & { key?: string }): number {
  return node.y ?? 0
}

type FlowDirection = 'from' | 'to'

export function nodeCount(
  list: Array<FromToElement>,
  prop: FlowDirection,
  seen: Set<SankeyNode> = new Set()
): number {
  let count = 0
  for (const elem of list) {
    if (seen.has(elem.node)) {
      continue
    }
    seen.add(elem.node)
    count += elem.node[prop].length + nodeCount(elem.node[prop], prop, seen)
  }
  return count
}

const flowByNodeCount =
  (prop: FlowDirection): ((a: FromToElement, b: FromToElement) => number) =>
  (a, b) =>
    nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop) ||
    a.node[prop].length - b.node[prop].length

function processFrom(node: SankeyNode, y: number): number {
  if (!node.from.length) return y

  node.from.sort(flowByNodeCount('from'))
  for (const flow of node.from) {
    const n = flow.node
    if (!defined(n.y)) {
      n.y = y
      processFrom(n, y ? y + SMALL_VALUE : 0)
    }
    y = Math.max(n.y + n.out, y)
  }
  return nodeY(node) + node.size
}

export const returnsToNearerColumn = (current: SankeyNode, next?: SankeyNode) =>
  Boolean(next && nodeX(next) < nodeX(current))

function processTo(node: SankeyNode, y: number): number {
  if (!node.to.length) return y

  // Place less-connected branches first so terminal paths stay close to the
  // edge of their source flow and more complex branches can continue inward.
  node.to.sort(flowByNodeCount('to'))
  for (let i = 0; i < node.to.length; i++) {
    const flow = node.to[i]
    const n = flow.node
    if (!defined(n.y)) {
      // A node may already have been positioned through another branch. Only
      // recurse when this is the first path that reaches it.
      n.y = y
      processTo(n, y ? y + SMALL_VALUE : 0)
    }
    if (returnsToNearerColumn(n, node.to[i + 1]?.node)) {
      // When traversal returns from a farther column to a nearer sibling,
      // advance within the source node by this link only. Using the farther
      // node's total size would also count inputs arriving from other paths
      // and push the nearer sibling too far down.
      y += flow.flow
    } else {
      // Within the same traversal direction, reserve the destination node's
      // full height so subsequently placed nodes cannot overlap it.
      y = Math.max(n.y + Math.max(n.in, n.out), y)
    }
  }
  return nodeY(node) + node.size
}

function setOrGetY(node: SankeyNode, value: number): number {
  if (defined(node.y)) {
    return node.y
  }
  node.y = value

  return value
}

function processRest(nodeArray: SankeyNode[], maxX: number) {
  const leftNodes = nodeArray.filter((node) => node.x === 0)
  const rightNodes = nodeArray.filter((node) => node.x === maxX)
  const leftToDo = leftNodes.filter((node) => !defined(node.y))
  const rightToDo = rightNodes.filter((node) => !defined(node.y))
  const centerToDo = nodeArray.filter(
    (node) => nodeX(node) > 0 && nodeX(node) < maxX && !defined(node.y)
  )

  let leftY =
    leftNodes.reduce((acc, cur) => Math.max(acc, nodeY(cur) + cur.out || 0), 0) + SMALL_VALUE
  let rightY =
    rightNodes.reduce((acc, cur) => Math.max(acc, nodeY(cur) + cur.in || 0), 0) + SMALL_VALUE
  let centerY = 0

  if (leftY >= rightY) {
    leftToDo.forEach((node) => {
      leftY = setOrGetY(node, leftY)
      leftY = Math.max(leftY + node.out, processTo(node, leftY))
    })

    rightToDo.forEach((node) => {
      rightY = setOrGetY(node, rightY)
      rightY = Math.max(rightY + node.in, processFrom(node, rightY))
    })
  } else {
    leftToDo.forEach((node) => {
      leftY = setOrGetY(node, leftY)
    })

    rightToDo.forEach((node) => {
      rightY = setOrGetY(node, rightY)
      rightY = Math.max(rightY + node.in, processFrom(node, rightY))
    })
  }
  centerToDo.forEach((node) => {
    let y = nodeArray
      .filter((n) => nodeX(n) === nodeX(node) && defined(n.y))
      .reduce((acc, cur) => Math.max(acc, nodeY(cur) + Math.max(cur.in, cur.out)), 0)
    y = setOrGetY(node, y)
    y = Math.max(y + node.in, processFrom(node, y))
    y = Math.max(y + node.out, processTo(node, y))
    centerY = Math.max(centerY, y)
  })

  return Math.max(leftY, rightY, centerY)
}

const fixTop = (nodeArray: SankeyNode[], maxX: number) => {
  let maxY = 0
  for (let x = 0; x <= maxX; x++) {
    const nodes = nodeArray.filter((n) => nodeX(n) === x).sort((a, b) => nodeY(a) - nodeY(b))
    let minY = 0
    for (const node of nodes) {
      if (nodeY(node) < minY) node.y = minY
      minY = nodeY(node) + node.size
    }
    maxY = Math.max(maxY, minY)
  }
  return maxY
}

const findStartNode = (nodeArray: SankeyNode[], maxX: number): SankeyNode => {
  const sorted = [...nodeArray].sort((a, b) => a.size - b.size)
  const largest = sorted.at(-1) as SankeyNode
  const size = largest.size
  const biggest = nodeArray.filter((n) => n.size === size)

  const first = biggest[0]
  if (biggest.length === 1) return first

  biggest.sort((a, b) => nodeX(a) - nodeX(b))

  // if there is a big node at left edge, use it as starting point
  if (nodeX(first) === 0) return first

  // same for right edge
  const last = biggest.at(-1) as SankeyNode
  if (nodeX(last) === maxX) return last

  // else start from center
  const mid = Math.floor(biggest.length / 2)
  return biggest[mid]
}

export function calculateY(nodeArray: SankeyNode[], maxX: number): number {
  if (!nodeArray.length) return 0

  const start = findStartNode(nodeArray, maxX)
  start.y = 0
  processFrom(start, 0)
  processTo(start, 0)
  processRest(nodeArray, maxX)
  return fixTop(nodeArray, maxX)
}

export function calculateYUsingPriority(nodeArray: SankeyNode[], maxX: number) {
  let maxY = 0
  let nextYStart = 0
  for (let x = 0; x <= maxX; x++) {
    let y = nextYStart
    const nodes = nodeArray
      .filter((node) => nodeX(node) === x)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    if (nodes.length) {
      const nextX = nodeArray.reduce(
        (next, node) => (nodeX(node) > x ? Math.min(next, nodeX(node)) : next),
        Infinity
      )
      nextYStart =
        nodes[0].to
          .filter((to) => nodeX(to.node) > nextX)
          .reduce((acc, cur) => acc + cur.flow, 0) || 0
    }
    for (const node of nodes) {
      node.y = y
      y += Math.max(node.out, node.in)
    }
    maxY = Math.max(y, maxY)
  }
  return maxY
}

interface LevelState {
  history: number[]
  realCount: number
}

/** Levels needed to clear the rows at or above `y` in the columns to the left. */
function clearLeftColumns(left: LevelState[], y: number, wanted: number): number {
  let levels = wanted
  for (const other of left) {
    const rows = other.history.filter((row) => row <= y).length
    levels = Math.max(rows, levels)
  }
  return levels
}

/**
 * A node with inputs has to clear every node stacked above it in the columns
 * to its left, or the flows into it would bend upwards by the gaps they skip.
 * Counts the whole gaps that this takes beyond the nodes above it in its own
 * column. `ordered` is sorted by column and position.
 */
function gapLevels(ordered: SankeyNode[]): Map<string, number> {
  const levels = new Map<string, number>()
  const grid: LevelState[] = []
  const index = new Map<number, number>()
  for (const node of ordered) {
    const x = nodeX(node)
    if (!index.has(x)) {
      index.set(x, grid.length)
      grid.push({ history: [], realCount: 0 })
    }
    const column = index.get(x) as number
    const state = grid[column]
    const y = nodeY(node)
    if (y) {
      state.history.push(y)
      let wanted = state.history.length
      if (node.in) {
        wanted = clearLeftColumns(grid.slice(0, column), y, wanted)
        while (state.history.length < wanted) state.history.push(y)
      }
      levels.set(node.key, Math.max(0, wanted - state.realCount))
    }
    state.realCount++
  }
  return levels
}

export interface ColumnOrder {
  columns: SankeyNode[][]
  /**
   * Free space above each node within its column, in flow units: how far the
   * depth-first placement moved it down from where packing the column would
   * put it. Keeps nodes beside the flows that skip their column.
   */
  offsets: Map<string, number>
  /** Where the depth-first placement put each node, in flow units */
  positions: Map<string, number>
  /**
   * Extra gaps, counted in whole gaps, a node needs above it so that its
   * inputs clear the nodes stacked above them in the columns to the left.
   */
  levels: Map<string, number>
}

/**
 * Order of the nodes within each column, top to bottom (or left to right when
 * the chart is vertical), derived from the value-unit placement worked out by
 * the depth-first passes above, plus the offset hint of every node. The nodes
 * must already carry their column in `x`. The placement itself is thrown away.
 */
export function orderColumns(
  nodes: SankeyNode[],
  maxColumn: number,
  usePriority: boolean
): ColumnOrder {
  if (usePriority) {
    calculateYUsingPriority(nodes, maxColumn)
  } else {
    calculateY(nodes, maxColumn)
  }
  const ordered = [...nodes].sort(
    (a, b) => nodeX(a) - nodeX(b) || nodeY(a) - nodeY(b) || a.size - b.size
  )
  const levels = gapLevels(ordered)
  const columns: SankeyNode[][] = Array.from({ length: maxColumn + 1 }, () => [])
  const offsets = new Map<string, number>()
  const positions = new Map<string, number>()
  const used = new Array<number>(maxColumn + 1).fill(0)
  const noise = 2 * SMALL_VALUE * nodes.length
  for (const node of ordered) {
    const x = nodeX(node)
    columns[x].push(node)
    // the depth-first passes nudge positions by SMALL_VALUE; that is not space
    const slack = nodeY(node) - used[x]
    offsets.set(node.key, slack > noise ? slack : 0)
    used[x] += node.size
    positions.set(node.key, nodeY(node))
    node.y = undefined
  }
  return { columns, levels, offsets, positions }
}
