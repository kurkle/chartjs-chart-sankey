import type { Route, SankeyNodeGap, SankeyOrientation, UW } from '../types.js'
import type { Extent, LaneSpace, Stack, Term } from './lane-space.js'
import type { Frame } from './route.js'
import type { Plan, PlanLink, PlanSlot } from './topology.js'

import { turnRadius } from './back-flow-path.js'
import { MAX_GAP_SHARE, PASSES, WAYPOINT_GAP } from './constants.js'
import { clearanceOf, floor, measure, planLaneSpace, termPixels } from './lane-space.js'
import { FRAMES } from './route.js'
import { pathIndex } from './topology.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface FlowRoute {
  /** A back flow: a band along a lane after the content */
  back: boolean
  height: number
  route: Route
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

/** What a column holds: a node or a waypoint, for the budget of the cross axis. */
interface ColumnItem {
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
 * the others, as flexbox does. `extra` are further terms of the column (the
 * loops under it), whose minimum shrinks by `factor`.
 */
export function solveScale(
  slots: readonly Pick<ColumnItem, 'min' | 'size'>[],
  available: number,
  extra: readonly Term[] = [],
  factor = 1
) {
  const count = slots.length + extra.length
  const frozen = new Uint8Array(count)
  const min = (i: number) =>
    i < slots.length ? slots[i].min : extra[i - slots.length].min * factor
  const size = (i: number) => (i < slots.length ? slots[i].size : extra[i - slots.length].size)
  for (;;) {
    let fixed = 0
    let units = 0
    for (let i = 0; i < count; i++) {
      if (frozen[i]) fixed += min(i)
      else units += size(i)
    }
    if (units <= 0) return Number.POSITIVE_INFINITY
    const k = Math.max(0, (available - fixed) / units)
    // freeze the items that would end up smaller than their minimum, and solve again
    const small = Array.from({ length: count }, (_, i) => i).filter(
      (i) => !frozen[i] && min(i) > 0 && k * size(i) < min(i)
    )
    if (!small.length) return k
    for (const i of small) frozen[i] = 1
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

/** Offsets of the flows on the edges of every slot of their path, by flow index and place in the path, in pixels. */
interface Offsets {
  entry: number[][]
  exit: number[][]
}

function portOffsets(plan: Plan, k: number): Offsets {
  const entry = plan.links.map((link) => new Array<number>(link.path.length).fill(0))
  const exit = plan.links.map((link) => new Array<number>(link.path.length).fill(0))
  for (const column of plan.slots) {
    for (const slot of column) {
      const natural = k * slot.size
      const place = (
        list: readonly PlanLink[],
        total: number,
        target: number[][],
        end: 'in' | 'out'
      ) => {
        const overlap = natural < k * total
        let sum = 0
        list.forEach((link, i) => {
          target[link.index][pathIndex(link, slot, end)] =
            overlap && list.length > 1 ? (i * (natural - k * link.flow)) / (list.length - 1) : sum
          sum += k * link.flow
        })
      }
      place(slot.in, slot.node?.in ?? slot.size, entry, 'in')
      place(slot.out, slot.node?.out ?? slot.size, exit, 'out')
    }
  }
  return { entry, exit }
}

function gapBetween(a: ColumnItem, b: ColumnItem, waypointGap: number): number {
  if (a.waypoint && b.waypoint) return waypointGap
  if (a.waypoint) return b.before
  if (b.waypoint) return a.after
  return Math.max(a.after, b.before)
}

const gapsOf = (slots: ColumnItem[], waypointGap: number) =>
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
  slots: ColumnItem[][]
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
    column.map((slot): ColumnItem => {
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

  let k = solveScale([], free - factor * along.shrinkable, along.terms, factor)
  slots.forEach((column, c) => {
    const base = axes.wExtent - gapTotals[c] * gapFactor
    k = Math.min(k, solveScale(column, base))
    for (const stack of space.columns[c]) {
      const available = base - stack.rigid - factor * stack.shrinkable
      k = Math.min(k, solveScale(column, available, stack.terms, factor))
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
  barSize: (slot: PlanSlot) => number
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
  offsets: Offsets
): Placement {
  const tops = new Map<PlanSlot, number>()
  const natural = (slot: PlanSlot) => k * slot.size
  const barSize = (slot: PlanSlot) =>
    Math.max(natural(slot), (slot.node && input.minSizes.get(slot.key)) || 0)
  const margin = (slot: PlanSlot) => (barSize(slot) - natural(slot)) / 2
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
      total += barSize(slot)
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
      const j = pathIndex(link, slot, forward ? 'in' : 'out')
      const other = link.path[forward ? j - 1 : j + 1]
      const theirs = forward
        ? naturalTop(other) + offsets.exit[link.index][j - 1]
        : naturalTop(other) + offsets.entry[link.index][j + 1]
      const own = forward ? offsets.entry[link.index][j] : offsets.exit[link.index][j]
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
  return { barSize, naturalTop, tops }
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

/** The pixels of a stack: its gaps and the thicknesses it stacks on. */
function stackPixels(stack: Stack, { factor, k }: Solution): number {
  return (
    factor * stack.lift + stack.chain.reduce((sum, term) => sum + termPixels(term, k, factor), 0)
  )
}

/**
 * Lanes start from the content, not from the edge of the chart: a loop sits
 * beyond the furthest content end of the columns it depends on (its own and
 * those of the loops it stacks on) by what its stack takes, the same stack the
 * budget counts. Loops that do not overlap end up at the same level, whatever
 * the loops beside them do.
 */
function placeLoops(
  space: LaneSpace,
  solution: Solution,
  contentEnd: number[]
): Map<PlanLink, LanePlace> {
  const places = new Map<PlanLink, LanePlace>()
  for (const loop of space.loops) {
    const content = Math.max(0, ...loop.reach.map((column) => contentEnd[column]))
    places.set(loop.link, {
      reach1: stackPixels(loop.out, solution),
      reach2: stackPixels(loop.into, solution),
      start: content + stackPixels(loop.cross, solution),
      thickness: termPixels(loop.thickness, solution.k, solution.factor),
    })
  }
  return places
}

export function computeGeometry(plan: Plan, input: GeometryInput): Geometry {
  const { area, borderWidth, insets, nodeWidth, orientation } = input
  const frame = FRAMES[orientation]
  // the axes, in (u, w): where the area starts and ends along the columns and across them
  const origin = frame.uw(area.left, area.top)
  const corner = frame.uw(area.right, area.bottom)
  const uStart = origin.u
  const uEnd = corner.u
  const wStart = origin.w
  // Whole pixels keep the bars on the pixel grid, which every browser rasterizes
  // alike; half a pixel would blur them differently from one browser to another.
  const half = Math.ceil(borderWidth / 2)
  const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0
  const axes: Axes = {
    borderSpace,
    columnLength: Math.max(0, uEnd - uStart - insets.start - insets.end - 2 * half),
    half,
    uStart,
    wExtent: Math.max(0, corner.w - wStart),
    wStart,
  }

  const space = planLaneSpace(plan, borderSpace)
  const solution = solve(plan, input, axes, space)
  const offsets = portOffsets(plan, solution.k)
  const rooms = columnRooms(plan, space, axes, solution)
  const { barSize, naturalTop, tops } = placeSlots(plan, input, solution, rooms, offsets)
  const starts = columnStarts(plan, input, axes, space, solution)

  const contentEnd = plan.slots.map((column) =>
    Math.max(0, ...column.map((slot) => (tops.get(slot) as number) + barSize(slot)))
  )
  const places = placeLoops(space, solution, contentEnd)
  const base = wStart

  const nodes = new Map<string, Rect>()
  for (const [key, slot] of plan.nodeSlots) {
    const top = base + (tops.get(slot) as number)
    nodes.set(key, frame.rect(starts[slot.column], top, nodeWidth, barSize(slot)))
  }

  const flows = plan.links.map((link): FlowRoute => {
    const thickness = solution.k * link.flow
    // (u, w) of the anchors: where the band leaves a slot and where it enters the next
    const anchors: UW[] = []
    link.path.forEach((slot, j) => {
      const start = starts[slot.column]
      const real = slot.node !== undefined
      const w = base + naturalTop(slot)
      if (j > 0) {
        anchors.push({
          u: start - (real ? borderSpace : 0),
          w: w + offsets.entry[link.index][j],
        })
      }
      if (j < link.path.length - 1) {
        anchors.push({
          u: start + nodeWidth + (real ? borderSpace : 0),
          w: w + offsets.exit[link.index][j],
        })
      }
    })
    const route = link.back
      ? laneRoute(link, anchors, places.get(link), base, solution, thickness)
      : ({ kind: 'band', points: anchors, t: thickness } as const)
    return { back: link.back, route, ...boxOf(route, frame) }
  })

  return { flows, k: solution.k, nodes }
}

/** A back flow runs from its source edge along its lane to its target edge. */
function laneRoute(
  link: PlanLink,
  [source, target]: UW[],
  place: LanePlace | undefined,
  offsetW: number,
  { factor }: Solution,
  thickness: number
): Route {
  const drawn = place ? place.thickness : 0
  // the centres of the band at its ends, as the drawing finds them from the box of the flow
  const c1 = source.w + thickness / 2 - drawn / 2 + drawn / 2
  const c2 = target.w + thickness / 2 - drawn / 2 + drawn / 2
  const lane = place ? offsetW + place.start + place.thickness / 2 : source.w + thickness / 2
  return {
    c1,
    c2,
    kind: 'lane',
    lane,
    radius: turnRadius(drawn, clearanceOf(link) * factor, lane, c1, c2),
    reach1: place?.reach1 ?? 0,
    reach2: place?.reach2 ?? 0,
    t: drawn,
    u1: source.u,
    u2: target.u,
  }
}

/** The box of the two ends of a route in x/y, which Chart.js animates and reads. */
function boxOf(route: Route, frame: Frame) {
  const first = route.kind === 'lane' ? { u: route.u1, w: route.c1 - route.t / 2 } : route.points[0]
  const last =
    route.kind === 'lane' ? { u: route.u2, w: route.c2 - route.t / 2 } : (route.points.at(-1) as UW)
  const from = frame.point(first.u, first.w)
  const to = frame.point(last.u, last.w)
  const { height, width } = frame.rect(0, 0, 0, route.t)
  return { height, width, x: from.x, x2: to.x, y: from.y, y2: to.y }
}
