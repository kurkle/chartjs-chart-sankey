import type { SankeyNodeGap, SankeyOrientation } from '../types.js'
import type { Plan, PlanLink, PlanSlot } from './topology.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface FlowRoute {
  /**
   * The anchor points of a flow that skips columns, as (x, y) of the top (left)
   * edge of its band: a curve from the first to the second point, a straight
   * run to the third, a curve to the fourth and so on. Missing for a flow
   * between neighbouring columns, which is just `x, y` to `x2, y2`.
   */
  points?: { x: number; y: number }[]
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

/**
 * Gap between two neighbouring waypoints, in pixels, unless the nodes ask for
 * less (a chart with no gaps has none between its waypoints either). Next to a
 * node a waypoint keeps the gap that node asks for on that side.
 */
const WAYPOINT_GAP = 2

/** Passes of the placement: forward, backward, forward, backward. */
const PASSES = 4

interface Slot {
  after: number
  before: number
  /** Minimum size in pixels */
  min: number
  /** Size in value units */
  size: number
  /** A waypoint of a flow, not a node */
  waypoint?: boolean
}

/**
 * The largest scale with which a column of nodes, each at least its minimum
 * size, fits in `available` pixels. A node whose scaled size would fall
 * below its minimum is frozen at the minimum and the scale solved again for
 * the others, as flexbox does.
 */
export function solveScale(slots: readonly Pick<Slot, 'min' | 'size'>[], available: number) {
  const frozen = new Set<number>()
  for (;;) {
    let fixed = 0
    let units = 0
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

type Offsets = Map<PlanSlot, Map<PlanLink, number>>

/** Offsets of each flow on the entry and exit edge of every slot, in pixels. */
function portOffsets(plan: Plan, k: number) {
  const entry: Offsets = new Map()
  const exit: Offsets = new Map()
  for (const column of plan.slots) {
    for (const slot of column) {
      const natural = k * slot.size
      const place = (list: readonly PlanLink[], total: number) => {
        const overlap = natural < k * total
        const offsets = new Map<PlanLink, number>()
        let sum = 0
        list.forEach((link, i) => {
          offsets.set(
            link,
            overlap && list.length > 1 ? (i * (natural - k * link.flow)) / (list.length - 1) : sum
          )
          sum += k * link.flow
        })
        return offsets
      }
      entry.set(slot, place(slot.in, slot.node?.in ?? slot.size))
      exit.set(slot, place(slot.out, slot.node?.out ?? slot.size))
    }
  }
  return { entry, exit }
}

function gapBetween(a: Slot, b: Slot, waypointGap: number): number {
  if (a.waypoint && b.waypoint) return waypointGap
  if (a.waypoint) return b.before
  if (b.waypoint) return a.after
  return Math.max(a.after, b.before)
}

const gapsOf = (slots: Slot[], waypointGap: number) =>
  slots.slice(1).map((slot, i) => gapBetween(slots[i], slot, waypointGap))

interface CrossAxis {
  /** Factor applied to every requested gap */
  gapFactor: number
  /** Gap between two neighbouring waypoints, before the factor */
  waypointGap: number
  k: number
  slots: Slot[][]
}

/** Gaps, minimum sizes, then one scale for the whole chart. */
function solveCrossAxis(plan: Plan, input: GeometryInput, extent: number): CrossAxis {
  const slots = plan.slots.map((column) =>
    column.map((slot): Slot => {
      const gap = (slot.node && input.gaps.get(slot.key)) || { after: 0, before: 0 }
      return {
        after: gap.after,
        before: gap.before,
        min: (slot.node && input.minSizes.get(slot.key)) || 0,
        size: slot.size,
        waypoint: !slot.node,
      }
    })
  )
  const asked = [...input.gaps.values()].flatMap((gap) => [gap.after, gap.before])
  const waypointGap = Math.min(WAYPOINT_GAP, ...asked)
  const gapTotals = slots.map((column) => gapsOf(column, waypointGap).reduce((a, b) => a + b, 0))
  const widestGaps = Math.max(0, ...gapTotals)
  // When the gaps alone would fill too much of the axis they all shrink by the
  // same factor; otherwise they are exactly as requested.
  const gapFactor = widestGaps > 0 ? Math.min(1, (MAX_GAP_SHARE * extent) / widestGaps) : 1

  let k = Number.POSITIVE_INFINITY
  slots.forEach((column, c) => {
    k = Math.min(k, solveScale(column, extent - gapTotals[c] * gapFactor))
  })
  return { gapFactor, k: Number.isFinite(k) ? k : 0, slots, waypointGap }
}

interface Placement {
  /** Size of the bar of a slot in pixels, minimum size included */
  slotOf: (slot: PlanSlot) => number
  /** Top of the part of a slot the flows use, relative to the cross axis start */
  naturalTop: (slot: PlanSlot) => number
  tops: Map<PlanSlot, number>
}

/**
 * Order is fixed, so only positions are decided. Every column starts packed
 * and centred; then a fixed number of passes forward and backward moves each
 * slot to where the flows to its neighbours in the previous (or next) column
 * meet their ports, and a fit pushes slots apart where they collide and back
 * into the chart area where they overflow.
 */
function placeSlots(
  plan: Plan,
  input: GeometryInput,
  { gapFactor, k, slots, waypointGap }: CrossAxis,
  extent: number,
  offsets: { entry: Offsets; exit: Offsets }
): Placement {
  const tops = new Map<PlanSlot, number>()
  const natural = (slot: PlanSlot) => k * slot.size
  const slotOf = (slot: PlanSlot) =>
    Math.max(natural(slot), (slot.node && input.minSizes.get(slot.key)) || 0)
  const margin = (slot: PlanSlot) => (slotOf(slot) - natural(slot)) / 2
  const naturalTop = (slot: PlanSlot) => (tops.get(slot) as number) + margin(slot)

  const packed: number[][] = []
  const totals: number[] = []
  plan.slots.forEach((column, c) => {
    const spacing = gapsOf(slots[c], waypointGap).map((gap) => gap * gapFactor)
    const offsetsOfColumn: number[] = []
    let total = 0
    column.forEach((slot, i) => {
      if (i) total += spacing[i - 1]
      offsetsOfColumn.push(total)
      total += slotOf(slot)
    })
    packed.push(offsetsOfColumn)
    totals.push(total)
    const start = Math.max(0, (extent - total) / 2)
    column.forEach((slot, i) => {
      tops.set(slot, start + offsetsOfColumn[i])
    })
  })

  /** Where the flows of a slot to the neighbouring column want it. */
  const wish = (slot: PlanSlot, forward: boolean) => {
    let sum = 0
    let weight = 0
    for (const link of forward ? slot.in : slot.out) {
      if (link.back) continue
      const j = link.path.indexOf(slot)
      const other = link.path[forward ? j - 1 : j + 1]
      const theirs = forward
        ? naturalTop(other) + (offsets.exit.get(other)?.get(link) ?? 0)
        : naturalTop(other) + (offsets.entry.get(other)?.get(link) ?? 0)
      const own = forward
        ? (offsets.entry.get(slot)?.get(link) ?? 0)
        : (offsets.exit.get(slot)?.get(link) ?? 0)
      sum += (theirs - own - margin(slot)) * link.flow
      weight += link.flow
    }
    return weight ? { top: sum / weight, weight } : { top: tops.get(slot) as number, weight: 1e-9 }
  }

  const rigid = input.paddingMode === 'even'
  for (let pass = 0; pass < PASSES; pass++) {
    const forward = pass % 2 === 0
    const order = plan.slots.map((_, c) => (forward ? c : plan.slots.length - 1 - c))
    for (const c of order) {
      const column = plan.slots[c]
      if (!column.length) continue
      const wishes = column.map((slot) => wish(slot, forward))
      const fitted = fitColumn(
        wishes.map((w) => w.top),
        wishes.map((w) => w.weight),
        packed[c],
        extent - totals[c],
        rigid
      )
      column.forEach((slot, i) => {
        tops.set(slot, fitted[i])
      })
    }
  }
  return { naturalTop, slotOf, tops }
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
  const { naturalTop, slotOf, tops } = placeSlots(plan, input, cross, wExtent, offsets)

  const nodes = new Map<string, Rect>()
  for (const [key, slot] of plan.slotOf) {
    const top = wStart + (tops.get(slot) as number)
    nodes.set(key, toRect(orientation, columnStart(slot.column), top, nodeWidth, slotOf(slot)))
  }

  const flows = plan.links.map((link): FlowRoute => {
    const thickness = cross.k * link.flow
    // (u, w) of the anchors: where the band leaves a slot and where it enters the next
    const anchors: Array<{ u: number; w: number }> = []
    link.path.forEach((slot, j) => {
      const start = columnStart(slot.column)
      const real = slot.node !== undefined
      const w = wStart + naturalTop(slot)
      if (j > 0) {
        anchors.push({
          u: start - (real ? borderSpace : 0),
          w: w + (offsets.entry.get(slot)?.get(link) ?? 0),
        })
      }
      if (j < link.path.length - 1) {
        anchors.push({
          u: start + nodeWidth + (real ? borderSpace : 0),
          w: w + (offsets.exit.get(slot)?.get(link) ?? 0),
        })
      }
    })
    const from = toXY(orientation, anchors[0].u, anchors[0].w)
    const end = anchors.at(-1) as { u: number; w: number }
    const to = toXY(orientation, end.u, end.w)
    return {
      height: vertical ? 0 : thickness,
      points:
        anchors.length > 2
          ? anchors.map((anchor) => toXY(orientation, anchor.u, anchor.w))
          : undefined,
      width: vertical ? thickness : 0,
      x: from.x,
      x2: to.x,
      y: from.y,
      y2: to.y,
    }
  })

  return { flows, k: cross.k, nodes }
}
