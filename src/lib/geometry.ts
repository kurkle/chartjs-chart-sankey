import type { SankeyNodeGap, SankeyOrientation } from '../types.js'
import type { Plan, PlanLink } from './topology.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface FlowRoute {
  height: number
  width: number
  x: number
  x2: number
  y: number
  y2: number
}

export interface GeometryInput {
  /** Space the diagram may use, in CSS pixels. */
  area: { bottom: number; left: number; right: number; top: number }
  /** Width of the node's outline; half of it is drawn outside the node. */
  borderWidth: number
  /** Gap before and after every node, by node key. */
  gaps: ReadonlyMap<string, NodeGap>
  /**
   * Room that labels of the outermost columns need outside the first and the
   * last column, along the column axis.
   */
  insets: { end: number; start: number }
  /** Minimum size of the drawn node bar, by node key. */
  minSizes: ReadonlyMap<string, number>
  nodeWidth: number
  orientation: SankeyOrientation
  paddingMode: 'auto' | 'even'
}

export interface Geometry {
  /** Flow routes by index in the dataset. */
  flows: FlowRoute[]
  /** Pixels per value unit. */
  k: number
  /** Drawn node bars by key. */
  nodes: Map<string, Rect>
}

/** The gaps may take at most this share of the cross axis. */
const MAX_GAP_SHARE = 0.5

interface Slot {
  after: number
  before: number
  /** Minimum size in pixels */
  min: number
  /** Size in value units */
  size: number
}

/**
 * The largest scale with which a column of nodes, each at least its minimum
 * size, fits in `available` pixels. `slack` is free space inside the column
 * that scales like the nodes (flow units). A node whose scaled size would fall
 * below its minimum is frozen at the minimum and the scale solved again for
 * the others, as flexbox does.
 */
export function solveScale(
  slots: readonly Pick<Slot, 'min' | 'size'>[],
  available: number,
  slack = 0
) {
  const frozen = new Set<number>()
  for (;;) {
    let fixed = 0
    let units = slack
    slots.forEach((slot, i) => {
      if (frozen.has(i)) fixed += slot.min
      else units += slot.size
    })
    if (units <= 0) return Number.POSITIVE_INFINITY
    const k = Math.max(0, (available - fixed) / units)
    let changed = false
    slots.forEach((slot, i) => {
      if (!frozen.has(i) && slot.min > 0 && k * slot.size < slot.min) {
        frozen.add(i)
        changed = true
      }
    })
    if (!changed) return k
  }
}

/**
 * Least-squares fit of positions to `ideal` that keeps the order and a minimum
 * distance between them, by pooling neighbours that would otherwise overlap.
 * `offsets[i]` is where node i starts when the column is packed, so that the
 * fit is a non-decreasing sequence of packed starts. Results are clamped into
 * [0, room].
 */
export function fitColumn(
  ideal: readonly number[],
  weights: readonly number[],
  offsets: readonly number[],
  room: number,
  rigid: boolean
): number[] {
  const blocks: { count: number; sum: number; weight: number }[] = []
  ideal.forEach((top, i) => {
    blocks.push({ count: 1, sum: (top - offsets[i]) * weights[i], weight: weights[i] })
    const mean = (block: (typeof blocks)[number]) => block.sum / block.weight
    while (
      blocks.length > 1 &&
      (rigid ||
        mean(blocks.at(-2) as (typeof blocks)[number]) >
          mean(blocks.at(-1) as (typeof blocks)[number]))
    ) {
      const last = blocks.pop() as (typeof blocks)[number]
      const prev = blocks.at(-1) as (typeof blocks)[number]
      prev.count += last.count
      prev.sum += last.sum
      prev.weight += last.weight
    }
  })
  const result: number[] = []
  for (const block of blocks) {
    const start = Math.min(Math.max(block.sum / block.weight, 0), Math.max(room, 0))
    for (let i = 0; i < block.count; i++) result.push(start + offsets[result.length])
  }
  return result
}

/** Single place where (u, w) turns into x/y: u runs along the columns. */
export function toXY(orientation: SankeyOrientation, u: number, w: number) {
  return orientation === 'vertical' ? { x: w, y: u } : { x: u, y: w }
}

function toRect(orientation: SankeyOrientation, u: number, w: number, du: number, dw: number) {
  const { x, y } = toXY(orientation, u, w)
  const vertical = orientation === 'vertical'
  return { height: vertical ? du : dw, width: vertical ? dw : du, x, y }
}

/** Offsets of each flow on its node's entry and exit edge, in pixels. */
function portOffsets(plan: Plan, k: number) {
  const outOffset = new Array<number>(plan.links.length).fill(0)
  const inOffset = new Array<number>(plan.links.length).fill(0)
  for (const [key, ports] of plan.ports) {
    const node = plan.nodes.get(key)
    if (!node) continue
    const natural = k * node.size
    const place = (list: readonly PlanLink[], target: number[], total: number) => {
      const overlap = natural < k * total
      let sum = 0
      list.forEach((link, i) => {
        target[link.index] =
          overlap && list.length > 1 ? (i * (natural - k * link.flow)) / (list.length - 1) : sum
        sum += k * link.flow
      })
    }
    place(ports.in, inOffset, node.in)
    place(ports.out, outOffset, node.out)
  }
  return { inOffset, outOffset }
}

/** Extra pixels above a node for the gaps it has to clear in other columns. */
const extraAbove = (plan: Plan, input: GeometryInput, key: string) =>
  input.paddingMode === 'even'
    ? 0
    : (plan.levels.get(key) ?? 0) * (input.gaps.get(key)?.before ?? 0)

const gapsOf = (slots: Slot[]) =>
  slots.slice(1).map((slot, i) => Math.max(slots[i].after, slot.before))

interface CrossAxis {
  /** Factor applied to every requested gap */
  gapFactor: number
  k: number
  slots: Slot[][]
}

/** Gaps, minimum sizes, then one scale for the whole chart. */
function solveCrossAxis(plan: Plan, input: GeometryInput, extent: number): CrossAxis {
  const slots = plan.columns.map((nodes) =>
    nodes.map((node): Slot => {
      const gap = input.gaps.get(node.key) ?? { after: 0, before: 0 }
      return {
        after: gap.after,
        before: gap.before,
        min: input.minSizes.get(node.key) ?? 0,
        size: node.size,
      }
    })
  )
  const gapTotals = slots.map((column) => gapsOf(column).reduce((a, b) => a + b, 0))
  const widestGaps = Math.max(0, ...gapTotals)
  // When the gaps alone would fill too much of the axis they all shrink by the
  // same factor; otherwise they are exactly as requested.
  const gapFactor = widestGaps > 0 ? Math.min(1, (MAX_GAP_SHARE * extent) / widestGaps) : 1

  let k = Number.POSITIVE_INFINITY
  slots.forEach((column, c) => {
    // the free space above the last node of the column scales with the flows
    const last = plan.columns[c].at(-1)
    const slack = last ? (plan.offsets.get(last.key) ?? 0) : 0
    const extra = last ? extraAbove(plan, input, last.key) * gapFactor : 0
    k = Math.min(k, solveScale(column, extent - gapTotals[c] * gapFactor - extra, slack))
  })
  return { gapFactor, k: Number.isFinite(k) ? k : 0, slots }
}

interface Placement {
  /** Size of the bar of a node in pixels, minimum size included */
  slotOf: (key: string) => number
  /** Top of the part of a node the flows use, relative to the cross axis start */
  naturalTop: (key: string) => number
  tops: Map<string, number>
}

/**
 * Order is fixed, so only positions are decided. Nodes go where the order
 * stage's offset hints put them, which keeps them beside the flows that skip
 * their column; the gaps are added in pixels on top, and the fit pushes nodes
 * apart where they collide and back into the chart area where they overflow.
 */
function placeNodes(plan: Plan, input: GeometryInput, cross: CrossAxis, extent: number) {
  const { k } = cross
  const tops = new Map<string, number>()
  const natural = (key: string) => k * (plan.nodes.get(key)?.size ?? 0)
  const slotOf = (key: string) => Math.max(natural(key), input.minSizes.get(key) ?? 0)
  const naturalTop = (key: string) => (tops.get(key) as number) + (slotOf(key) - natural(key)) / 2

  plan.columns.forEach((nodes, c) => {
    const spacing = gapsOf(cross.slots[c]).map((gap) => gap * cross.gapFactor)
    const packed: number[] = []
    let total = 0
    nodes.forEach((node, i) => {
      if (i) total += spacing[i - 1]
      packed.push(total)
      total += slotOf(node.key)
    })
    const ideal = nodes.map(
      (node, i) =>
        packed[i] +
        k * (plan.offsets.get(node.key) ?? 0) +
        extraAbove(plan, input, node.key) * cross.gapFactor
    )
    // 'even' keeps the first node where the hint puts it and packs the rest
    const weights = nodes.map((_, i) => (input.paddingMode === 'even' && i ? 1e-9 : 1))
    const fitted = fitColumn(ideal, weights, packed, extent - total, input.paddingMode === 'even')
    nodes.forEach((node, i) => {
      tops.set(node.key, fitted[i])
    })
  })
  return { naturalTop, slotOf, tops } as Placement
}

export function computeGeometry(plan: Plan, input: GeometryInput): Geometry {
  const { area, borderWidth, insets, nodeWidth, orientation } = input
  const vertical = orientation === 'vertical'
  const uStart = vertical ? area.top : area.left
  const uEnd = vertical ? area.bottom : area.right
  const wStart = vertical ? area.left : area.top
  const wExtent = Math.max(0, (vertical ? area.right : area.bottom) - wStart)

  // Column axis: columns are evenly spaced between the outermost node edges.
  // Whole pixels keep the bars on the pixel grid, which every browser rasterizes
  // alike; half a pixel would blur them differently from one browser to another.
  const half = Math.ceil(borderWidth / 2)
  const first = uStart + insets.start + half
  const last = uEnd - insets.end - half - nodeWidth
  const pitch = plan.maxColumn ? Math.max(0, last - first) / plan.maxColumn : 0
  const columnStart = (column: number) => first + column * pitch
  const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0

  const cross = solveCrossAxis(plan, input, wExtent)
  const offsets = portOffsets(plan, cross.k)
  const { naturalTop, slotOf, tops } = placeNodes(plan, input, cross, wExtent)

  const nodes = new Map<string, Rect>()
  for (const node of plan.nodes.values()) {
    const top = wStart + (tops.get(node.key) ?? 0)
    nodes.set(
      node.key,
      toRect(orientation, columnStart(node.x ?? 0), top, nodeWidth, slotOf(node.key))
    )
  }

  const flows = plan.links.map((link): FlowRoute => {
    const from = toXY(
      orientation,
      columnStart(link.from.x ?? 0) + nodeWidth + borderSpace,
      wStart + naturalTop(link.from.key) + offsets.outOffset[link.index]
    )
    const to = toXY(
      orientation,
      columnStart(link.to.x ?? 0) - borderSpace,
      wStart + naturalTop(link.to.key) + offsets.inOffset[link.index]
    )
    const thickness = cross.k * link.flow
    return {
      height: vertical ? 0 : thickness,
      width: vertical ? thickness : 0,
      x: from.x,
      x2: to.x,
      y: from.y,
      y2: to.y,
    }
  })

  return { flows, k: cross.k, nodes }
}
