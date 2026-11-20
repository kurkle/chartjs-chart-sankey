import type { LoopVertex, Route, SankeyNodeGap, SankeyOrientation, UW } from '../types.js'
import type { Frame } from './route.js'
import type { Plan, PlanLink, PlanSlot, PlanStop, Side } from './topology.js'
import type { Extent, Term, Turn, TurnSpace } from './turns.js'

import { CHAIN_WEIGHT, MAX_GAP_SHARE, MIN_THICKNESS, PASSES, WAYPOINT_GAP } from './constants.js'
import { fitRadii } from './loop-path.js'
import { FRAMES } from './route.js'
import { sidesOf } from './topology.js'
import { clearanceOf, floor, measure, planTurnSpace, termPixels } from './turns.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface FlowRoute {
  /** A back flow: a band through its loop slots */
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

/** What a column holds: a node, a waypoint or a loop slot, for the budget of the cross axis. */
interface ColumnItem {
  after: number
  before: number
  /** Minimum size in pixels */
  min: number
  /** Size in value units */
  size: number
  /** A waypoint or a loop slot of a flow, not a node */
  waypoint?: boolean
  /** The key of the node, or of the slot */
  key: string
  /** The nodes a loop slot turns back to, and the room the turn needs next to one of them */
  ends?: readonly string[]
  turn?: number
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

/**
 * Offsets of the flows on the edges of every slot of their path, by flow index
 * and place in the path, in pixels: `entry` where the flow arrives, `exit`
 * where it leaves.
 */
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
      for (const side of SIDES) {
        const list = slot[side]
        const nodeTotal = side === 'left' ? slot.node?.in : slot.node?.out
        const total = nodeTotal ?? slot.size
        const overlap = natural < k * total
        let sum = 0
        list.forEach(({ at, link }, i) => {
          const target = sidesOf(link, at).arrive === side ? entry : exit
          target[link.index][at] =
            overlap && list.length > 1 ? (i * (natural - k * link.flow)) / (list.length - 1) : sum
          sum += k * link.flow
        })
      }
    }
  }
  return { entry, exit }
}

const SIDES: Side[] = ['left', 'right']

/** Minimum size in pixels of a slot: the bar of a node, a hairline for a loop slot. */
function minOf(slot: PlanSlot, input: GeometryInput): number {
  if (slot.node) return input.minSizes.get(slot.key) || 0
  return slot.kind === 'loop' ? MIN_THICKNESS : 0
}

/** The room a loop slot needs next to the node its flow turns to: enough for the turn. */
const turnRoom = (slot: ColumnItem, node: ColumnItem) =>
  slot.ends?.includes(node.key) ? (slot.turn ?? 0) : 0

function gapBetween(a: ColumnItem, b: ColumnItem, waypointGap: number): number {
  if (a.waypoint && b.waypoint) return waypointGap
  if (a.waypoint) return Math.max(b.before, turnRoom(a, b))
  if (b.waypoint) return Math.max(a.after, turnRoom(b, a))
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
function columnBudget(space: TurnSpace): Extent {
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
 * back flows. A column holds its nodes, waypoints and loop slots with their
 * gaps, one constraint for each. Fixed pixels that do not fit shrink by one
 * common factor: the gaps and the turns may take half of what is left on
 * their axis.
 */
function solve(plan: Plan, input: GeometryInput, axes: Axes, space: TurnSpace): Solution {
  const slots = plan.slots.map((column) =>
    column.map((slot): ColumnItem => {
      const gap = (slot.node && input.gaps.get(slot.key)) || { after: 0, before: 0 }
      const link = slot.kind === 'loop' ? slot.link : undefined
      return {
        after: gap.after,
        before: gap.before,
        ends: link && [link.from.key, link.to.key],
        key: slot.key,
        min: minOf(slot, input),
        size: slot.size,
        turn: link && 2 * clearanceOf(link),
        waypoint: !slot.node,
      }
    })
  )
  const asked = [...input.gaps.values()].flatMap((gap) => [gap.after, gap.before])
  const waypointGap = Math.min(WAYPOINT_GAP, ...asked)
  const gapTotals = slots.map((column) => sum(gapsOf(column, waypointGap)))
  // When the fixed pixels alone would fill too much of the axis they all shrink
  // by the same factor; otherwise they are exactly as requested.
  const crossFixed = Math.max(0, ...gapTotals)
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
    k = Math.min(k, solveScale(column, axes.wExtent - gapTotals[c] * gapFactor))
  })
  return { factor, gapFactor, k: Number.isFinite(k) ? k : 0, slots, waypointGap }
}

interface Placement {
  /** Size of the bar of a slot in pixels, minimum size included */
  barSize: (slot: PlanSlot) => number
  /** Top of the part of a slot the flows use, relative to the cross axis start */
  naturalTop: (slot: PlanSlot) => number
  tops: Map<PlanSlot, number>
}

/**
 * The cross axis distance of a flow between where it leaves a slot and where it
 * enters the next one in another column, times its flow (and heavier along the
 * slots of a back flow, which should run straight). The turns of a back flow
 * beside a column are not counted.
 */
function bendOf(link: PlanLink, naturalTop: (slot: PlanSlot) => number, offsets: Offsets) {
  let distance = 0
  for (let i = 1; i < link.path.length; i++) {
    if (link.path[i].column === link.path[i - 1].column) continue
    const entry = naturalTop(link.path[i]) + offsets.entry[link.index][i]
    const exit = naturalTop(link.path[i - 1]) + offsets.exit[link.index][i - 1]
    distance += Math.abs(entry - exit)
  }
  return link.flow * distance * (link.back ? CHAIN_WEIGHT : 1)
}

/**
 * Where a flow wants the slot, seen from the slot on its side (`left`: in the
 * previous column, `right`: in the next one), given the slot's own port offset
 * and margin. A flow whose other slot is in the same column (a turn of a back
 * flow) wants nothing.
 */
function wishOf(
  { at, link }: PlanStop,
  slot: PlanSlot,
  side: Side,
  naturalTop: (slot: PlanSlot) => number,
  offsets: Offsets
): { other: PlanSlot; top: number } | undefined {
  const arrives = sidesOf(link, at).arrive === side
  const other = link.path[arrives ? at - 1 : at + 1]
  if (other.column === slot.column) return undefined
  const theirs = arrives
    ? naturalTop(other) + offsets.exit[link.index][at - 1]
    : naturalTop(other) + offsets.entry[link.index][at + 1]
  const own = arrives ? offsets.entry[link.index][at] : offsets.exit[link.index][at]
  return { other, top: theirs - own }
}

function weightedMean(wishes: Array<[top: number, weight: number]>) {
  const total = wishes.reduce((sum, [, weight]) => sum + weight, 0)
  return {
    top: wishes.reduce((sum, [top, weight]) => sum + top * weight, 0) / total,
    weight: total,
  }
}

function weightedMedian(wishes: Array<[top: number, weight: number]>) {
  const sorted = [...wishes].sort((a, b) => a[0] - b[0])
  const total = sorted.reduce((sum, [, weight]) => sum + weight, 0)
  if (total <= 0) return { top: 0, weight: 0 }
  let seen = 0
  for (const [top, weight] of sorted) {
    seen += weight
    if (seen >= total / 2) return { top, weight: total }
  }
  return { top: sorted[0][0], weight: total }
}

/**
 * Order is fixed, so only positions are decided. The column that sets the scale
 * fills its axis, so it is placed first, packed from the start of the cross
 * axis; the other columns follow outwards from it, every slot at the position
 * where its flows meet the ports of the neighbours that are already placed. A
 * slot without a placed neighbour, and any room the wishes leave open, goes
 * towards the start of the axis. A fit pushes slots apart where they collide
 * and back into the chart area where they overflow, and a few passes over all
 * columns then straighten the flows with the neighbours on both sides.
 */
function placeSlots(
  plan: Plan,
  input: GeometryInput,
  { gapFactor, k, slots, waypointGap }: Solution,
  room: number,
  offsets: Offsets
): Placement {
  const tops = new Map<PlanSlot, number>()
  const natural = (slot: PlanSlot) => k * slot.size
  const barSize = (slot: PlanSlot) =>
    Math.max(natural(slot), (slot.node && input.minSizes.get(slot.key)) || 0)
  const margin = (slot: PlanSlot) => (barSize(slot) - natural(slot)) / 2
  const naturalTop = (slot: PlanSlot) => (tops.get(slot) as number) + margin(slot)

  // every column packed from the start of the axis
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
    column.forEach((slot, i) => {
      tops.set(slot, offsetsOfColumn[i])
    })
  })

  /**
   * Where the flows of a slot want it, from the neighbours before it, after it
   * or both, as far as they are placed. Without any it stays where it is.
   */
  const wish = (slot: PlanSlot, sides: Side[], placed?: Set<number>, median = true) => {
    const wishes: Array<[top: number, weight: number]> = []
    for (const side of sides) {
      for (const stop of slot[side]) {
        const wanted = wishOf(stop, slot, side, naturalTop, offsets)
        if (!wanted || (placed && !placed.has(wanted.other.column))) continue
        wishes.push([
          wanted.top - margin(slot),
          stop.link.flow * (stop.link.back ? CHAIN_WEIGHT : 1),
        ])
      }
    }
    const result = median ? weightedMedian(wishes) : weightedMean(wishes)
    return result.weight > 0 ? result : { top: tops.get(slot) as number, weight: 1e-9 }
  }

  const rigid = input.paddingMode === 'even'
  const place = (c: number, sides: Side[], placed?: Set<number>, median = true) => {
    const column = plan.slots[c]
    if (!column.length) return
    const wishes = column.map((slot) => wish(slot, sides, placed, median))
    const fitted = fitColumn(
      wishes.map((w) => w.top),
      wishes.map((w) => w.weight),
      packed[c],
      room - totals[c],
      rigid
    )
    column.forEach((slot, i) => {
      tops.set(slot, fitted[i])
    })
  }

  // the column that fills its axis best sets the scale: start there
  const fullness = totals.map((total) => (room > 0 ? total / room : 0))
  const anchor = fullness.indexOf(Math.max(...fullness))
  const placed = new Set<number>([anchor])
  place(anchor, [])
  for (let step = 1; step < plan.slots.length; step++) {
    // a column before the anchor takes its flows from the column after it, and the other way round
    for (const [c, sides] of [
      [anchor + step, ['left']],
      [anchor - step, ['right']],
    ] as const) {
      if (c < 0 || c >= plan.slots.length) continue
      place(c, [...sides], placed)
      placed.add(c)
    }
  }
  // Straightening passes over all columns, with the median or the mean of the wishes: the
  // placement with the least total bend wins, the outward one included.
  const bend = () =>
    plan.links.reduce((total, link) => total + bendOf(link, naturalTop, offsets), 0)
  const straighten = (median: boolean) => {
    for (let pass = 0; pass < PASSES; pass++) {
      const order = plan.slots.map((_, c) => (pass % 2 === 0 ? c : plan.slots.length - 1 - c))
      for (const c of order) place(c, ['left', 'right'], undefined, median)
    }
  }
  const outward = new Map(tops)
  let best = { bend: bend(), tops: outward }
  for (const median of [true, false]) {
    tops.clear()
    for (const [slot, top] of outward) tops.set(slot, top)
    straighten(median)
    const total = bend()
    if (total < best.bend - 1e-9) best = { bend: total, tops: new Map(tops) }
  }
  tops.clear()
  for (const [slot, top] of best.tops) tops.set(slot, top)
  return { barSize, naturalTop, tops }
}

/**
 * Where the columns start on the column axis. A gap between two columns holds
 * the turns of the back flows beside the two, and what is left over is shared
 * equally between the gaps. The waypoints and the loop slots of a column sit at
 * the same start, so a straight run across it stays level with the nodes.
 */
function columnStarts(
  plan: Plan,
  input: GeometryInput,
  axes: Axes,
  space: TurnSpace,
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

/** The pixels a turn sticks out from the node edge, beyond its radius: the turns it goes around and its fixed gaps. */
const reachOf = (turn: Turn, { factor, k }: Solution): number =>
  factor * turn.lift + turn.chain.reduce((total, term) => total + termPixels(term, k, factor), 0)

/** The pieces of a route in (u, w) that the slots of a flow give: the anchors and the centres. */
interface Stop {
  /** where the band meets the slot's left and right edge, on the column axis */
  left: number
  right: number
  /** the centre of the band across, where it arrives and where it leaves */
  arrive: number
  leave: number
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

  const space = planTurnSpace(plan, borderSpace)
  const solution = solve(plan, input, axes, space)
  const offsets = portOffsets(plan, solution.k)
  const { barSize, naturalTop, tops } = placeSlots(plan, input, solution, axes.wExtent, offsets)
  const starts = columnStarts(plan, input, axes, space, solution)
  const base = wStart

  const nodes = new Map<string, Rect>()
  for (const [key, slot] of plan.nodeSlots) {
    const top = base + (tops.get(slot) as number)
    nodes.set(key, frame.rect(starts[slot.column], top, nodeWidth, barSize(slot)))
  }

  const anchorsOf = (link: PlanLink): UW[] => {
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
    return anchors
  }

  const turnsOf = new Map<PlanLink, Turn[]>()
  for (const hook of plan.hooks) {
    turnsOf.set(hook.link, [...(turnsOf.get(hook.link) ?? []), space.turns.get(hook) as Turn])
  }

  const loopRoute = (link: PlanLink): Route => {
    const thickness = solution.k * link.flow
    const drawn = Math.max(thickness, MIN_THICKNESS * solution.factor)
    const stops = link.path.map((slot, j): Stop => {
      const start = starts[slot.column]
      const real = slot.node !== undefined
      const w = base + naturalTop(slot) + thickness / 2
      return {
        arrive: w + offsets.entry[link.index][j],
        leave: w + offsets.exit[link.index][j],
        left: start - (real ? borderSpace : 0),
        right: start + nodeWidth + (real ? borderSpace : 0),
      }
    })
    return {
      kind: 'loop',
      points: loopVertices(link, stops, turnsOf.get(link) as Turn[], space, solution, drawn),
      t: drawn,
    }
  }
  const routeOf = (link: PlanLink): Route => {
    if (!link.back) return { kind: 'band', points: anchorsOf(link), t: solution.k * link.flow }
    return link.flow > 0 ? loopRoute(link) : { kind: 'loop', points: [], t: 0 }
  }
  const flows = plan.links.map((link): FlowRoute => {
    const route = routeOf(link)
    return { back: link.back, route, ...boxOf(route, frame) }
  })

  return { flows, k: solution.k, nodes }
}

/**
 * The centre line of a back flow: out of the source edge, a turn in the gap
 * after the source column, through the slot of every column from the source's to
 * the target's (a step across in the gap where the next slot is level
 * differently) and a turn in the gap before the target column into the target
 * edge. Corners are rounded as far as the room across and along allows.
 */
function loopVertices(
  link: PlanLink,
  stops: Stop[],
  turns: Turn[],
  space: TurnSpace,
  solution: Solution,
  t: number
): LoopVertex[] {
  const { factor } = solution
  const last = stops.length - 1
  const want = t / 2 + clearanceOf(link) * factor
  const [sourceTurn, targetTurn] = turns
  const turnAt = [
    stops[0].right + want + reachOf(sourceTurn, solution),
    stops[last].left - want - reachOf(targetTurn, solution),
  ]
  const points: LoopVertex[] = [{ r: 0, u: stops[0].right, w: stops[0].leave }]
  const corner = (u: number, w: number) => points.push({ r: want, u, w })
  corner(turnAt[0], stops[0].leave)
  corner(turnAt[0], stops[1].arrive)
  // from the slot of the source column to that of the target column
  for (let j = 1; j < last - 1; j++) {
    const [here, next] = [stops[j], stops[j + 1]]
    const column = link.path[j].column
    // the middle of what the turns beside the two columns leave free of the gap
    const mid =
      (here.left -
        measure(space.left[column], solution.k, factor) +
        (next.right + measure(space.right[column - 1], solution.k, factor))) /
      2
    corner(mid, here.leave)
    corner(mid, next.arrive)
  }
  corner(turnAt[1], stops[last - 1].leave)
  corner(turnAt[1], stops[last].arrive)
  points.push({ r: 0, u: stops[last].left, w: stops[last].arrive })
  return fitRadii(points)
}

/** The box of the two ends of a route in x/y, which Chart.js animates and reads. */
function boxOf(route: Route, frame: Frame) {
  const first = route.points[0] ?? { u: 0, w: 0 }
  const last = route.points.at(-1) ?? first
  const top = (p: UW) => (route.kind === 'loop' ? { u: p.u, w: p.w - route.t / 2 } : p)
  const from = frame.point(top(first).u, top(first).w)
  const to = frame.point(top(last).u, top(last).w)
  const { height, width } = frame.rect(0, 0, 0, route.t)
  return { height, width, x: from.x, x2: to.x, y: from.y, y2: to.y }
}
