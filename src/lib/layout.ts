import type { SankeyControllerDatasetOptions, SankeyNode, SankeyNodeGap } from '../types.js'
import type { Plan } from './topology.js'

function nodeX(node: Pick<SankeyNode, 'x'> & { key?: string }): number {
  return node.x ?? 0
}

function nodeY(node: Pick<SankeyNode, 'y'> & { key?: string }): number {
  return node.y ?? 0
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
  /**
   * Half of the previous real node's `nodeMinSize` stretch (see
   * `extraHalfFor`), carried so the transition to the next real node in this
   * column can reserve room for both nodes' stretch, not just the requested
   * gap.
   */
  lastExtraHalf: number
  realCount: number
  realCumOffset: number
  yHistory: number[]
}

function createColumnGapState(): ColumnGapState {
  return { lastAfter: 0, lastExtraHalf: 0, realCount: 0, realCumOffset: 0, yHistory: [] }
}

/**
 * Half of how much a node's drawn bar is stretched beyond its natural
 * (flow-space) `size` to satisfy `nodeMinSize`, in the same flow units as
 * `size`. The stretch is applied symmetrically around the node's real
 * position (see `getNodeRect` in controller.ts), so only half of it eats into
 * the gap above/below the node -- the other half eats into the gap on the
 * other side.
 */
function extraHalfFor(
  node: Pick<PaddableNode, 'key' | 'size'>,
  minSizes: Map<string, number>,
  scale: number
): number {
  const minSizeUnits = (minSizes.get(node.key) ?? 0) * scale
  return Math.max(0, minSizeUnits - node.size) / 2
}

/**
 * The flow-unit height of a node's drawn bar after stretching for
 * `nodeMinSize` (or its natural `size`, if that already meets the minimum).
 */
function stretchedSize(
  node: Pick<PaddableNode, 'key' | 'size'>,
  minSizes: Map<string, number>,
  scale: number
): number {
  const minSizeUnits = (minSizes.get(node.key) ?? 0) * scale
  return Math.max(node.size, minSizeUnits)
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
// `extraHalf` is this node's own `nodeMinSize` stretch (see `extraHalfFor`).
// Only the real (non-virtual) transition gains it, and only combined with the
// previous real node's `lastExtraHalf`: together the two halves reserve
// exactly enough room for both nodes' stretched bars not to overlap. Virtual
// cross-column levels are left untouched -- there is no concrete neighbor
// above to stretch away from.
function offsetForNode(
  state: ColumnGapState,
  gap: NodeGap,
  paddings: number,
  scale: number,
  extraHalf: number
): number {
  const realNodesAbove = state.realCount
  const before = gap.before * scale
  const after = gap.after * scale
  const transitionGap =
    realNodesAbove > 0 ? Math.max(state.lastAfter, before) + state.lastExtraHalf + extraHalf : 0
  const realCumOffset = state.realCumOffset + transitionGap
  const virtualLevels = paddings - realNodesAbove

  state.realCount = realNodesAbove + 1
  state.realCumOffset = realCumOffset
  state.lastAfter = after
  state.lastExtraHalf = extraHalf

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
 * gap in this mode is exactly `max(prev.after, next.before)`, nothing more --
 * plus, when `nodeMinSize` stretches a bar beyond its natural `size`, half of
 * each of the two nodes' stretch (see `extraHalfFor`), so the stretched bars
 * still clear each other by the requested gap.
 */
function addEvenPadding(
  nodeArray: PaddableNode[],
  gaps: Map<string, NodeGap>,
  scale: number,
  minSizes: Map<string, number>
) {
  let maxY = 0
  let columnX: number | undefined
  let prev: PaddableNode | undefined
  let prevGap: NodeGap | undefined
  let prevExtraHalf = 0

  for (const node of nodeArray) {
    const x = nodeX(node)
    const gap = gaps.get(node.key) ?? { after: 0, before: 0 }
    const extraHalf = extraHalfFor(node, minSizes, scale)

    if (x !== columnX) {
      columnX = x
    } else if (prev && prevGap) {
      node.y =
        nodeY(prev) +
        prev.size +
        Math.max(prevGap.after, gap.before) * scale +
        prevExtraHalf +
        extraHalf
    }

    prev = node
    prevGap = gap
    prevExtraHalf = extraHalf
    const H = stretchedSize(node, minSizes, scale)
    maxY = Math.max(
      maxY,
      nodeY(node) + Math.max(node.in, node.out),
      nodeY(node) + (node.size + H) / 2
    )
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
  mode: NodePaddingMode = 'auto',
  minSizes: Map<string, number> = new Map()
): number {
  // sort nodes by x/y, so we can iterate them by rows
  nodeArray.sort(nodeByXYSize)

  if (mode === 'even') {
    return addEvenPadding(nodeArray, gaps, scale, minSizes)
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
    const extraHalf = extraHalfFor(node, minSizes, scale)

    if (y) {
      state.yHistory.push(y)
      let paddings = state.yHistory.length

      if (node.in) {
        paddings = countCrossColumnPaddings(grid, colIdx, y, paddings)
        while (state.yHistory.length < paddings) state.yHistory.push(y)
      }

      node.y = y + offsetForNode(state, gap, paddings, scale, extraHalf)
    } else {
      // The topmost node in a column never receives an offset, but it still
      // needs to be recorded so the first real gap below it can collapse
      // against its `after` value (and, now, its own `nodeMinSize` stretch).
      state.realCount += 1
      state.lastAfter = gap.after * scale
      state.lastExtraHalf = extraHalf
    }

    const H = stretchedSize(node, minSizes, scale)
    maxY = Math.max(
      maxY,
      nodeY(node) + Math.max(node.in, node.out),
      nodeY(node) + (node.size + H) / 2
    )
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
  /** chart height in CSS pixels */
  height: number
  /** vertical before/after gap per node, in CSS pixels */
  nodePadding: Map<string, NodeGap>
  /** how nodePadding gaps are distributed within a column, defaults to 'auto' */
  nodePaddingMode: SankeyControllerDatasetOptions['nodePaddingMode']
  /** minimum drawn node size per node, in CSS pixels */
  nodeMinSize?: Map<string, number>
}

export function layout(
  plan: Plan,
  { height, nodePadding, nodePaddingMode, nodeMinSize }: LayoutOptions
): { maxY: number } {
  const nodeArray = [...plan.nodes.values()]
  const scale = plan.valueExtent / height
  const maxYWithPadding = addPadding(
    nodeArray,
    nodePadding,
    scale,
    nodePaddingMode ?? 'auto',
    nodeMinSize ?? new Map()
  )

  sortFlows(nodeArray)

  return { maxY: maxYWithPadding }
}
