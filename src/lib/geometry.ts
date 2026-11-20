import type { SankeyNodeGap, SankeyOrientation } from '../types.js'
import type { Extent, LaneSpace } from './lane-space.js'
import type { Plan, PlanLink, PlanSlot } from './topology.js'

import {
  clearanceOf,
  firstGapOf,
  floor,
  gapBelow,
  measure,
  planLaneSpace,
  shrinkTerms,
  termPixels,
} from './lane-space.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface FlowRoute {
  /** A back flow: a band along a lane, see back-flow-path.ts */
  back: boolean
  /** Inner radius of the turns of a back flow */
  clear: number
  /** Center of the lane on the cross axis, in x or y (back flows) */
  lane: number
  /** How far the turn at the source end sticks out from the node edge, beyond its radius (back flows) */
  reach: number
  /** The same at the target end */
  reach2: number
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

interface Axes {
  /** Length of the column axis available to the columns and the turns */
  columnLength: number
  uStart: number
  wExtent: number
  wStart: number
  /** Room a node edge keeps from the flows next to it */
  borderSpace: number
  /** Half the outline of the node bars, in whole pixels */
  half: number
}

interface Solution {
  /** Factor applied to the requested gaps */
  gapFactor: number
  /** Factor applied to the fixed pixels of lanes and turns, never above `gapFactor` */
  factor: number
  /** Gap between two neighbouring waypoints, before the factor */
  waypointGap: number
  k: number
  slots: Slot[][]
}

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

/** Terms and pixels the column axis has to hold besides the nodes. */
function columnBudget(space: LaneSpace): Extent {
  const parts = [space.lead, space.trail, ...space.gaps]
  return {
    rigid: sum(parts.map((part) => part.rigid)),
    shrinkable: sum(parts.map((part) => part.shrinkable)),
    terms: parts.flatMap((part) => part.terms),
  }
}

/**
 * One scale for the whole chart: the largest `k` for which every column fits
 * the cross axis and the column axis holds the columns and the turns of the
 * back flows. A column holds its nodes and waypoints with their gaps and,
 * beyond them, the loops that run under it: one constraint for each loop that
 * reaches the column (a loop's room is its own thickness, the thicknesses of
 * the loops it stacks on and fixed gaps), so a loop costs the columns it
 * passes and no others. Fixed pixels that do not fit shrink by one common
 * factor: the gaps, the lanes and the turns may take half of what is left on
 * their axis.
 */
function solve(plan: Plan, input: GeometryInput, axes: Axes, space: LaneSpace): Solution {
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
  const gapTotals = slots.map((column) => sum(gapsOf(column, waypointGap)))
  // When the fixed pixels alone would fill too much of the axis they all shrink
  // by the same factor; otherwise they are exactly as requested.
  const crossFixed = Math.max(
    0,
    ...gapTotals.map((total, c) => total + Math.max(0, ...space.columns[c].map(floor)))
  )
  const gapFactor = crossFixed > 0 ? Math.min(1, (MAX_GAP_SHARE * axes.wExtent) / crossFixed) : 1

  const along = columnBudget(space)
  const nodesLength =
    (plan.maxColumn + 1) * input.nodeWidth + 2 * axes.borderSpace * plan.maxColumn + along.rigid
  const free = axes.columnLength - nodesLength
  const alongFloor = floor(along)
  const turnsFactor =
    alongFloor > 0 ? Math.min(1, Math.max(0, (MAX_GAP_SHARE * free) / alongFloor)) : 1
  const factor = Math.min(gapFactor, turnsFactor)

  let k = solveScale(shrinkTerms(along.terms, factor), free - factor * along.shrinkable)
  slots.forEach((column, c) => {
    const base = axes.wExtent - gapTotals[c] * gapFactor
    k = Math.min(k, solveScale(column, base))
    for (const stack of space.columns[c]) {
      const available = base - stack.rigid - factor * stack.shrinkable
      k = Math.min(k, solveScale([...column, ...shrinkTerms(stack.terms, factor)], available))
    }
  })
  return { factor, gapFactor, k: Number.isFinite(k) ? k : 0, slots, waypointGap }
}

/** The room of a column for its content: the axis less what the loops under it take. */
function columnRooms(plan: Plan, space: LaneSpace, axes: Axes, { factor, k }: Solution): number[] {
  return space.columns.map((stacks, c) => {
    const taken = Math.max(
      0,
      ...stacks.map(
        (stack) =>
          stack.rigid +
          factor * stack.shrinkable +
          sum(stack.terms.map((term) => termPixels(term, k, factor)))
      )
    )
    return plan.slots[c] ? axes.wExtent - taken : axes.wExtent
  })
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
  { gapFactor, k, slots, waypointGap }: Solution,
  rooms: number[],
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
    const start = Math.max(0, (rooms[c] - total) / 2)
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
        rooms[c] - totals[c],
        rigid
      )
      column.forEach((slot, i) => {
        tops.set(slot, fitted[i])
      })
    }
  }
  return { naturalTop, slotOf, tops }
}

/**
 * Where the columns start on the column axis. A gap between two columns holds
 * the turns of the back flows that leave the one and enter the other, and
 * what is left over is shared equally between the gaps. The waypoints of a
 * skipped column sit at the same start, so a straight run across it stays
 * level with the nodes.
 */
function columnStarts(
  plan: Plan,
  input: GeometryInput,
  axes: Axes,
  space: LaneSpace,
  { factor, k }: Solution
): number[] {
  const { nodeWidth } = input
  const need = space.gaps.map((gap) => nodeWidth + 2 * axes.borderSpace + measure(gap, k, factor))
  const first = axes.uStart + input.insets.start + axes.half + measure(space.lead, k, factor)
  const last =
    axes.uStart +
    axes.columnLength +
    input.insets.start +
    axes.half -
    measure(space.trail, k, factor) -
    nodeWidth
  const share = plan.maxColumn ? Math.max(0, (last - first - sum(need)) / plan.maxColumn) : 0
  const starts = [first]
  need.forEach((gap) => {
    starts.push((starts.at(-1) as number) + gap + share)
  })
  return starts
}

/** Where a loop's band runs, in pixels from the start of the cross axis, and how far its turns reach out. */
interface LanePlace {
  /** The side of the band towards the content, and its thickness */
  start: number
  thickness: number
  /** Distances of the turns from the node edges, beyond their radius */
  reach1: number
  reach2: number
}

/**
 * Lanes start from the content, not from the edge of the chart: a loop sits
 * just beyond the furthest content end of the columns it runs under and
 * beyond the loops it stacks on. Loops that do not overlap end up at the same
 * level, whatever the loops beside them do.
 */
function placeLoops(space: LaneSpace, { factor, k }: Solution, contentEnd: number[]): LanePlace[] {
  const places: LanePlace[] = []
  for (const loop of space.loops) {
    const thickness = termPixels(loop.thickness, k, factor)
    let start = firstGapOf(loop.clear) * factor
    let base = Number.NEGATIVE_INFINITY
    for (let c = loop.first; c <= loop.last; c++) base = Math.max(base, contentEnd[c])
    start += Math.max(0, base)
    let reach1 = 0
    let reach2 = 0
    for (const rank of loop.below) {
      const other = space.loops[rank]
      const lower = places[rank]
      start = Math.max(start, lower.start + lower.thickness + gapBelow(other, loop) * factor)
      const above = lower.thickness + gapBelow(other, loop) * factor
      if (other.link.from === loop.link.from) reach1 = Math.max(reach1, lower.reach1 + above)
      if (other.link.to === loop.link.to) reach2 = Math.max(reach2, lower.reach2 + above)
    }
    places.push({ reach1, reach2, start, thickness })
  }
  return places
}

export function computeGeometry(plan: Plan, input: GeometryInput): Geometry {
  const { area, borderWidth, insets, nodeWidth, orientation } = input
  const vertical = orientation === 'vertical'
  const uStart = vertical ? area.top : area.left
  const uEnd = vertical ? area.bottom : area.right
  const wStart = vertical ? area.left : area.top
  // Whole pixels keep the bars on the pixel grid, which every browser rasterizes
  // alike; half a pixel would blur them differently from one browser to another.
  const half = Math.ceil(borderWidth / 2)
  const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0
  const axes: Axes = {
    borderSpace,
    columnLength: Math.max(0, uEnd - uStart - insets.start - insets.end - 2 * half),
    half,
    uStart,
    wExtent: Math.max(0, (vertical ? area.right : area.bottom) - wStart),
    wStart,
  }

  const space = planLaneSpace(plan, borderSpace)
  const solution = solve(plan, input, axes, space)
  const offsets = portOffsets(plan, solution.k)
  const rooms = columnRooms(plan, space, axes, solution)
  const { naturalTop, slotOf, tops } = placeSlots(plan, input, solution, rooms, offsets)
  const starts = columnStarts(plan, input, axes, space, solution)

  const contentEnd = plan.slots.map((column) =>
    Math.max(0, ...column.map((slot) => (tops.get(slot) as number) + slotOf(slot)))
  )
  const places = placeLoops(space, solution, contentEnd)
  const base = wStart

  const nodes = new Map<string, Rect>()
  for (const [key, slot] of plan.slotOf) {
    const top = base + (tops.get(slot) as number)
    nodes.set(key, toRect(orientation, starts[slot.column], top, nodeWidth, slotOf(slot)))
  }

  const flows = plan.links.map((link): FlowRoute => {
    const thickness = solution.k * link.flow
    // (u, w) of the anchors: where the band leaves a slot and where it enters the next
    const anchors: Array<{ u: number; w: number }> = []
    link.path.forEach((slot, j) => {
      const start = starts[slot.column]
      const real = slot.node !== undefined
      const w = base + naturalTop(slot)
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
    if (link.back) {
      return backRoute(link, {
        anchors,
        offsetW: base,
        orientation,
        place: places[link.lane],
        solution,
        thickness,
      })
    }
    const from = toXY(orientation, anchors[0].u, anchors[0].w)
    const end = anchors.at(-1) as { u: number; w: number }
    const to = toXY(orientation, end.u, end.w)
    return {
      back: false,
      clear: 0,
      height: vertical ? 0 : thickness,
      lane: 0,
      points:
        anchors.length > 2
          ? anchors.map((anchor) => toXY(orientation, anchor.u, anchor.w))
          : undefined,
      reach: 0,
      reach2: 0,
      width: vertical ? thickness : 0,
      x: from.x,
      x2: to.x,
      y: from.y,
      y2: to.y,
    }
  })

  return { flows, k: solution.k, nodes }
}

interface BackRouteInput {
  /** The source edge and the target edge of the flow, in (u, w) */
  anchors: Array<{ u: number; w: number }>
  offsetW: number
  orientation: SankeyOrientation
  /** The lane of the flow; none for an empty flow */
  place: LanePlace | undefined
  solution: Solution
  thickness: number
}

/** A back flow runs from its source edge along its lane to its target edge. */
function backRoute(link: PlanLink, input: BackRouteInput): FlowRoute {
  const { anchors, offsetW, orientation, place, solution, thickness } = input
  const vertical = orientation === 'vertical'
  const drawn = place ? place.thickness : 0
  const [source, target] = [anchors[0], anchors[1]]
  const c1 = source.w + thickness / 2
  const c2 = target.w + thickness / 2
  const from = toXY(orientation, source.u, c1 - drawn / 2)
  const to = toXY(orientation, target.u, c2 - drawn / 2)
  return {
    back: true,
    clear: clearanceOf(link) * solution.factor,
    height: vertical ? 0 : drawn,
    lane: place ? offsetW + place.start + place.thickness / 2 : c1,
    reach: place?.reach1 ?? 0,
    reach2: place?.reach2 ?? 0,
    width: vertical ? drawn : 0,
    x: from.x,
    x2: to.x,
    y: from.y,
    y2: to.y,
  }
}
