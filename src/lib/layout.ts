import type {
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyNode,
  SankeyNodeGap,
} from '../types.js'

import { defined } from './helpers.js'

const SMALL_VALUE = 1e-6

export type SankeyMode = 'edge' | 'even'

function nodeX(node: Pick<SankeyNode, 'x'> & { key?: string }): number {
  return node.x ?? 0
}

function nodeY(node: Pick<SankeyNode, 'y'> & { key?: string }): number {
  return node.y ?? 0
}

/**
 * Get all keys the input nodes flow to, including keys of the input nodes
 */
export const getAllKeysForward = (
  nodes: SankeyNode[],
  visited: Set<string> = new Set()
): string[] => {
  const keys: string[] = []
  for (const node of nodes) {
    if (visited.has(node.key)) continue
    visited.add(node.key)
    keys.push(
      node.key,
      ...getAllKeysForward(
        node.to.map((to) => to.node),
        visited
      )
    )
  }

  return keys
}

/**
 * Find the nodes that should be placed leftmost on the chart.
 * NOTE: With circular flows, data order matters.
 */
export const startColumn = (data: SankeyDataPoint[], nodes: SankeyNode[]): string[] => {
  // First check if there are nodes without any input. Start from those.
  const startNodes = nodes.filter((node) => node.from.length === 0)
  const column = startNodes.map((node) => node.key)

  const startRef = getAllKeysForward(startNodes)

  // If there are no nodes without any inputs, this is a fully circular chart.
  // Build the start column based on data order and references.
  const referencedNodes = new Set(startRef)

  for (const point of data) {
    if (!referencedNodes.has(point.from) && !referencedNodes.has(point.to)) {
      column.push(point.from)
      referencedNodes.add(point.from)
    }
    referencedNodes.add(point.to)
  }
  return column
}

/**
 * Figure out the next column from remainingKeys
 * @param dataWithoutDirectLoops - data filtered so it does not contain direct loops (from === to)
 * @param remainingKeys - they keys that are not yet placed to the chart
 * @returns array of node keys to place in the next column
 */
const nextColumn = (
  dataWithoutDirectLoops: SankeyDataPoint[],
  remainingKeys: Set<string>
): string[] => {
  const remainingTo = new Set(
    dataWithoutDirectLoops.filter((flow) => remainingKeys.has(flow.from)).map((flow) => flow.to)
  )
  const remainingKeyArray = [...remainingKeys]
  const columnsNotInTo = remainingKeyArray.filter((key) => !remainingTo.has(key))

  return columnsNotInTo.length ? columnsNotInTo : remainingKeyArray.slice(0, 1)
}

export function calculateX(
  nodeMap: Map<string, SankeyNode>,
  data: SankeyDataPoint[],
  mode: SankeyMode
): number {
  const dataWithoutDirectLoops = data.filter((dp) => dp.from !== dp.to)
  const allKeys = [...nodeMap.keys()]
  const allNodes = [...nodeMap.values()]
  const keysToPlace = new Set(allKeys)
  let x = 0
  while (keysToPlace.size) {
    const column =
      x === 0 ? startColumn(data, allNodes) : nextColumn(dataWithoutDirectLoops, keysToPlace)

    if (!column.length) {
      // In case thre is a bug in column determination, throw an error instead of looping endlessly.
      throw new Error('Fatal error: Unable to place nodes to columns. Please report this issue.')
    }

    for (const key of column) {
      const node = nodeMap.get(key)
      if (node && !defined(node.x)) {
        node.x = x
      }
      keysToPlace.delete(key)
    }
    if (keysToPlace.size) {
      x++
    }
  }

  // Calculate the maxX from nodes in case some were placed by column option
  const maxX = allNodes.reduce((max, node) => Math.max(max, nodeX(node)), 0)

  if (mode === 'edge') {
    // Move nodes that have no output to the right edge of the flow
    const from = new Set(data.map((dataPoint) => dataPoint.from))
    allKeys
      .filter((key) => !from.has(key))
      .forEach((key) => {
        const node = nodeMap.get(key)
        // Only move the node to right edge, if it's column is not defined
        if (node && !node.column) {
          node.x = maxX
        }
      })
  }

  return maxX
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
  const largest = sorted[sorted.length - 1]
  const size = largest.size
  const biggest = nodeArray.filter((n) => n.size === size)

  const first = biggest[0]
  if (biggest.length === 1) return first

  biggest.sort((a, b) => nodeX(a) - nodeX(b))

  // if there is a big node at left edge, use it as starting point
  if (nodeX(first) === 0) return first

  // same for right edge
  const last = biggest[biggest.length - 1]
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

type NodeXYSize = Pick<SankeyNode, 'x' | 'y' | 'size'>
const nodeByXYSize = (a: NodeXYSize, b: NodeXYSize): number => {
  if (nodeX(a) !== nodeX(b)) return nodeX(a) - nodeX(b)
  if (nodeY(a) === nodeY(b)) return a.size - b.size
  return nodeY(a) - nodeY(b)
}

type PaddableNode = Pick<SankeyNode, 'in' | 'key' | 'out' | 'size' | 'x' | 'y'>
type NodeGap = Required<SankeyNodeGap>

/**
 * Per-column bookkeeping used while walking nodes top-to-bottom.
 *
 * `yHistory` mirrors the original (pre-per-node-gap) algorithm's `column`
 * array: it holds the un-padded y of every "padding level" seen in this
 * column, including virtual duplicates added to satisfy a cross-column
 * requirement. It only exists to reproduce the exact same level count (see
 * `countCrossColumnPaddings`), regardless of which gaps are in play.
 *
 * `realCount`/`realCumOffset`/`lastAfter` track the *real* nodes seen in this
 * column so far, so the actual vertical gap between two adjacent real nodes
 * (`max(prev.after, next.before)`) can be summed independently of any
 * cross-column padding inflation.
 */
interface ColumnGapState {
  lastAfter: number
  realCount: number
  realCumOffset: number
  yHistory: number[]
}

function createColumnGapState(): ColumnGapState {
  return { lastAfter: 0, realCount: 0, realCumOffset: 0, yHistory: [] }
}

// Count how many padding levels this node needs, based on how many nodes are
// above it in columns to the left (its inputs must clear all of them).
function countCrossColumnPaddings(
  grid: ColumnGapState[],
  colIdx: number,
  y: number,
  ownPaddings: number
): number {
  let paddings = ownPaddings
  for (let col = 0; col < colIdx; col++) {
    const otherHistory = grid[col].yHistory
    for (let row = 0; row < otherHistory.length; row++) {
      if (otherHistory[row] > y) break
      paddings = Math.max(row + 1, paddings)
    }
  }
  return paddings
}

// Offset for a node with `paddings` total levels, of which `state.realCount`
// are backed by a real predecessor in the same column (summed using the
// collapsing `max(prev.after, next.before)` rule) and the rest are virtual
// levels demanded by a column to the left, valued at this node's own
// `before` (there is no other node to collapse against).
function offsetForNode(
  state: ColumnGapState,
  gap: NodeGap,
  paddings: number,
  scale: number
): number {
  const realNodesAbove = state.realCount
  const before = gap.before * scale
  const after = gap.after * scale
  const transitionGap = realNodesAbove > 0 ? Math.max(state.lastAfter, before) : 0
  const realCumOffset = state.realCumOffset + transitionGap
  const virtualLevels = paddings - realNodesAbove

  state.realCount = realNodesAbove + 1
  state.realCumOffset = realCumOffset
  state.lastAfter = after

  return realCumOffset + virtualLevels * before
}

export type NodePaddingMode = 'auto' | 'even'

/**
 * `'even'` mode for addPadding(): lay out each column's nodes back-to-back,
 * using the *drawn* `size` of the previous node (not its `in`/`out` flow
 * total, which may be larger for a `size: 'min'` node) so the visible gaps
 * within a column come out equal. The topmost node of a column keeps its
 * existing `y` -- this is what keeps a short column anchored to the sources
 * that feed it instead of floating it to the top of the chart. Cross-column
 * padding levels (see `countCrossColumnPaddings`) do not apply here: every
 * gap in this mode is exactly `max(prev.after, next.before)`, nothing more.
 */
function addEvenPadding(nodeArray: PaddableNode[], gaps: Map<string, NodeGap>, scale: number) {
  let maxY = 0
  let columnX: number | undefined
  let prev: PaddableNode | undefined
  let prevGap: NodeGap | undefined

  for (const node of nodeArray) {
    const x = nodeX(node)
    const gap = gaps.get(node.key) ?? { after: 0, before: 0 }

    if (x !== columnX) {
      columnX = x
    } else if (prev && prevGap) {
      node.y = nodeY(prev) + prev.size + Math.max(prevGap.after, gap.before) * scale
    }

    prev = node
    prevGap = gap
    maxY = Math.max(maxY, nodeY(node) + Math.max(node.in, node.out))
  }

  return maxY
}

/**
 * @return {number} maxY
 */
export function addPadding(
  nodeArray: PaddableNode[],
  gaps: Map<string, NodeGap>,
  scale = 1,
  mode: NodePaddingMode = 'auto'
): number {
  // sort nodes by x/y, so we can iterate them by rows
  nodeArray.sort(nodeByXYSize)

  if (mode === 'even') {
    return addEvenPadding(nodeArray, gaps, scale)
  }

  let maxY = 0
  const columnXs = new Map<number, number>()
  const grid: ColumnGapState[] = []

  const getColIndex = (x: number) => {
    if (!columnXs.has(x)) {
      const index = grid.length
      columnXs.set(x, index)
      grid.push(createColumnGapState())
      return index
    }
    return columnXs.get(x) ?? 0
  }

  for (const node of nodeArray) {
    const colIdx = getColIndex(nodeX(node))
    const state = grid[colIdx]
    const gap = gaps.get(node.key) ?? { after: 0, before: 0 }
    const y = nodeY(node)

    if (y) {
      state.yHistory.push(y)
      let paddings = state.yHistory.length

      if (node.in) {
        paddings = countCrossColumnPaddings(grid, colIdx, y, paddings)
        while (state.yHistory.length < paddings) state.yHistory.push(y)
      }

      node.y = y + offsetForNode(state, gap, paddings, scale)
    } else {
      // The topmost node in a column never receives an offset, but it still
      // needs to be recorded so the first real gap below it can collapse
      // against its `after` value.
      state.realCount += 1
      state.lastAfter = gap.after * scale
    }

    maxY = Math.max(maxY, nodeY(node) + Math.max(node.in, node.out))
  }

  return maxY
}

export function sortFlows(nodeArray: SankeyNode[]) {
  nodeArray.forEach((node) => {
    const nodeSize = node.size
    const overlapFrom = nodeSize < node.in
    const overlapTo = nodeSize < node.out
    let addY = 0
    let len = node.from.length
    node.from
      .sort((a, b) => nodeY(a.node) + a.node.out / 2 - (nodeY(b.node) + b.node.out / 2))
      .forEach((flow, idx) => {
        if (overlapFrom) {
          flow.addY = (idx * (nodeSize - flow.flow)) / (len - 1)
        } else {
          flow.addY = addY
          addY += flow.flow
        }
      })
    addY = 0
    len = node.to.length
    node.to
      .sort((a, b) => nodeY(a.node) + a.node.in / 2 - (nodeY(b.node) + b.node.in / 2))
      .forEach((flow, idx) => {
        if (overlapTo) {
          flow.addY = (idx * (nodeSize - flow.flow)) / (len - 1)
        } else {
          flow.addY = addY
          addY += flow.flow
        }
      })
  })
}

interface LayoutOptions {
  /** use node priority when sorting nodes vertically */
  priority: boolean
  /** chart height in CSS pixels */
  height: number
  /** vertical before/after gap per node, in CSS pixels */
  nodePadding: Map<string, NodeGap>
  /** how nodePadding gaps are distributed within a column, defaults to 'auto' */
  nodePaddingMode: SankeyControllerDatasetOptions['nodePaddingMode']
  /** layout mode in x-direction */
  modeX: SankeyControllerDatasetOptions['modeX']
}

export function layout(
  nodes: Map<string, SankeyNode>,
  data: SankeyDataPoint[],
  { priority, height, nodePadding, nodePaddingMode, modeX }: LayoutOptions
): { maxY: number; maxX: number } {
  const nodeArray = [...nodes.values()]
  const maxX = calculateX(nodes, data, modeX ?? 'edge')
  const maxY = priority ? calculateYUsingPriority(nodeArray, maxX) : calculateY(nodeArray, maxX)
  const scale = maxY / height
  const maxYWithPadding = addPadding(nodeArray, nodePadding, scale, nodePaddingMode ?? 'auto')

  sortFlows(nodeArray)

  return { maxX, maxY: maxYWithPadding }
}
