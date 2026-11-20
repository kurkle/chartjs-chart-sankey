import type { Route, SankeyNodeGap, SankeyOrientation, UW } from '../types.js'
import type { LaneSpace, Loop } from './lane-space.js'
import type { Plan, PlanLink, PlanSlot } from './topology.js'

import { MAX_GAP_SHARE, PASSES, WAYPOINT_GAP } from './constants.js'
import { buildLoops, measureLoops, placeLoops } from './lane-space.js'
import { pathIndex } from './topology.js'

type NodeGap = Required<SankeyNodeGap>

export interface Rect {
  height: number
  width: number
  x: number
  y: number
}

/** The box of the two ends of a flow in x/y, which Chart.js animates and reads, and its route. */
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

/** What a column holds, for the budget of the cross axis. */
interface Item {
  /** Size in flow units, and the least size in pixels */
  size: number
  min: number
  /** The gaps of a node; a waypoint has none of its own */
  gap?: NodeGap
}

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

/** Slack of a comparison in pixels, and the number of times the scale is halved when it is searched. */
const EPSILON = 1e-9
const HALVINGS = 50

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
  type Block = { count: number; sum: number; weight: number }
  const mean = (block: Block) => block.sum / block.weight
  const blocks: Block[] = []
  ideal.forEach((top, i) => {
    let block = { count: 1, sum: (top - offsets[i]) * weights[i], weight: weights[i] }
    for (
      let prev = blocks.at(-1);
      prev && (rigid || mean(prev) > mean(block));
      prev = blocks.at(-1)
    ) {
      blocks.pop()
      block = {
        count: prev.count + block.count,
        sum: prev.sum + block.sum,
        weight: prev.weight + block.weight,
      }
    }
    blocks.push(block)
  })
  const result: number[] = []
  for (const block of blocks) {
    const start = Math.min(Math.max(mean(block), 0), Math.max(room, 0))
    for (let i = 0; i < block.count; i++) result.push(start + offsets[result.length])
  }
  return result
}

/** Offsets of the flows on the edges of every slot of their path, by flow index and place in the path, in pixels. */
function portOffsets(plan: Plan, k: number) {
  const entry = plan.links.map((link) => link.path.map(() => 0))
  const exit = plan.links.map((link) => link.path.map(() => 0))
  for (const slot of plan.slots.flat()) {
    const natural = k * slot.size
    const place = (list: PlanLink[], total: number, target: number[][], end: 'in' | 'out') => {
      // flows that do not fit side by side are spread evenly over the edge
      const overlap = natural < k * total && list.length > 1
      let offset = 0
      list.forEach((link, i) => {
        target[link.index][pathIndex(link, slot, end)] = overlap
          ? (i * (natural - k * link.flow)) / (list.length - 1)
          : offset
        offset += k * link.flow
      })
    }
    place(slot.in, slot.node?.in ?? slot.size, entry, 'in')
    place(slot.out, slot.node?.out ?? slot.size, exit, 'out')
  }
  return { entry, exit }
}

/** The gaps between the neighbours of a column: the larger of what two nodes ask for, a waypoint asks for nothing. */
const gapsOf = (items: Item[], waypointGap: number) =>
  items.slice(1).map((b, i) => {
    const a = items[i]
    if (!a.gap || !b.gap) return b.gap?.before ?? a.gap?.after ?? waypointGap
    return Math.max(a.gap.after, b.gap.before)
  })

/** The axes in (u, w), `u` along the columns and `w` across them, and the fixed sizes. */
interface Axes {
  /** Length of the column axis available to the columns and the turns */
  columnLength: number
  uStart: number
  wExtent: number
  /** Room a node edge keeps from the flows next to it */
  borderSpace: number
  /** Half the outline of the node bars, in whole pixels */
  half: number
  nodeWidth: number
  /** Room for the labels outside the first column */
  inset: number
  /** What the turns beyond the first or the last column take: nothing without one, else the room of the node edge too */
  edge: (turn: number, own?: number) => number
}

interface Solution {
  /** Factor applied to the fixed pixels of lanes and turns, never above the one of the gaps */
  factor: number
  /** Pixels per flow unit */
  k: number
  /** The gaps of each column, in pixels */
  spacing: number[][]
  /** What the loops take */
  space: LaneSpace
}

/**
 * One scale for the whole chart: the largest `k` for which every column fits
 * the cross axis, with its nodes and waypoints, their gaps and the loops that
 * run under it, and the column axis holds the columns and the turns of the
 * loops. Everything grows with the scale, so the largest one that fits is
 * found by halving. Fixed pixels that do not fit shrink by one common factor:
 * the gaps, the lanes and the turns may take half of what is left on their
 * axis.
 */
function solve(
  plan: Plan,
  items: Item[][],
  gaps: GeometryInput['gaps'],
  axes: Axes,
  loops: Loop[]
): Solution {
  const count = plan.slots.length
  // Neighbouring waypoints keep a small gap, unless the nodes ask for less.
  const asked = [...gaps.values()].flatMap((gap) => [gap.after, gap.before])
  const requested = items.map((column) => gapsOf(column, Math.min(WAYPOINT_GAP, ...asked)))
  // The turns of the loops, and between two columns a run for the flows between them.
  const along = (space: LaneSpace) => sum(space.out) + sum(space.into) + space.run * plan.maxColumn

  // When the fixed pixels alone would fill too much of the axis they all shrink
  // by the same factor; otherwise they are exactly as requested.
  const fixed = measureLoops(loops, count, 0, 1)
  const crossFixed = Math.max(0, ...requested.map((column, c) => sum(column) + fixed.depth[c]))
  const gapFactor = crossFixed > 0 ? Math.min(1, (MAX_GAP_SHARE * axes.wExtent) / crossFixed) : 1
  const free =
    axes.columnLength -
    count * axes.nodeWidth -
    2 * axes.borderSpace * plan.maxColumn -
    axes.edge(fixed.into[0], 0) -
    axes.edge(fixed.out[count - 1], 0)
  const alongFixed = along(fixed)
  const turnsFactor =
    alongFixed > 0 ? Math.min(1, Math.max(0, (MAX_GAP_SHARE * free) / alongFixed)) : 1
  const factor = Math.min(gapFactor, turnsFactor)

  const rooms = requested.map((column) => axes.wExtent - sum(column) * gapFactor)
  const fitsColumn = (c: number, k: number, space: LaneSpace) => {
    const content = sum(items[c].map((item) => Math.max(k * item.size, item.min)))
    return content + space.depth[c] <= rooms[c] + EPSILON
  }
  // a column whose minimum sizes do not fit overflows whatever the scale, so it does not hold the others back
  const least = measureLoops(loops, count, 0, factor)
  const open = items.map((_, c) => fitsColumn(c, 0, least))
  const fits = (k: number) => {
    const space = measureLoops(loops, count, k, factor)
    return (
      (!loops.length || along(space) <= free + EPSILON) &&
      items.every((_, c) => !open[c] || fitsColumn(c, k, space))
    )
  }
  // No column can be scaled further than to fill its axis with nothing but its content.
  const units = items.map((column) => sum(column.map((item) => item.size)))
  let high = Math.min(
    ...units.map((size, c) => (open[c] && size > 0 ? rooms[c] / size : Number.POSITIVE_INFINITY))
  )
  let k = 0
  if (!(high > 0) || !Number.isFinite(high)) high = 0
  else if (fits(high)) k = high
  for (let i = 0; i < HALVINGS && k < high; i++) {
    const middle = (k + high) / 2
    if (fits(middle)) k = middle
    else high = middle
  }
  return {
    factor,
    k,
    space: measureLoops(loops, count, k, factor),
    spacing: requested.map((column) => column.map((gap) => gap * gapFactor)),
  }
}

interface Placed {
  /** Size of the bar in pixels, minimum size included */
  bar: number
  /** Start of the bar, from the start of the cross axis */
  top: number
  /** What the bar is larger than the part the flows use, on each side */
  margin: number
}

/**
 * Order is fixed, so only positions are decided. Every column starts packed
 * and centred; then a fixed number of passes forward and backward moves each
 * slot to where the flows to its neighbours in the previous (or next) column
 * meet their ports, and a fit pushes slots apart where they collide and back
 * into the room of the column (the axis less what the loops under it take)
 * where they overflow.
 */
function placeSlots(
  plan: Plan,
  items: Item[][],
  { k, space, spacing }: Solution,
  wExtent: number,
  offsets: ReturnType<typeof portOffsets>,
  rigid: boolean
) {
  const placed = new Map<PlanSlot, Placed>()
  const at = (slot: PlanSlot) => placed.get(slot) as Placed
  const rooms = space.depth.map((depth) => wExtent - depth)
  const packed: number[][] = []
  const totals: number[] = []
  plan.slots.forEach((column, c) => {
    let total = 0
    packed[c] = column.map((slot, i) => {
      const start = i ? total + spacing[c][i - 1] : total
      const bar = Math.max(k * slot.size, items[c][i].min)
      placed.set(slot, { bar, margin: (bar - k * slot.size) / 2, top: 0 })
      total = start + bar
      return start
    })
    totals[c] = total
    column.forEach((slot, i) => {
      at(slot).top = Math.max(0, (rooms[c] - total) / 2) + packed[c][i]
    })
  })

  /** Where the flows of a slot to the neighbouring column want it. */
  const wish = (slot: PlanSlot, forward: boolean) => {
    const [mine, theirs, step] = forward
      ? [offsets.entry, offsets.exit, -1]
      : [offsets.exit, offsets.entry, 1]
    let total = 0
    let weight = 0
    for (const link of forward ? slot.in : slot.out) {
      if (link.back) continue
      const j = pathIndex(link, slot, forward ? 'in' : 'out')
      const other = at(link.path[j + step])
      const port = other.top + other.margin + theirs[link.index][j + step]
      total += (port - mine[link.index][j] - at(slot).margin) * link.flow
      weight += link.flow
    }
    return weight ? { top: total / weight, weight } : { top: at(slot).top, weight: 1e-9 }
  }

  for (let pass = 0; pass < PASSES; pass++) {
    const forward = pass % 2 === 0
    const order = plan.slots.map((_, c) => (forward ? c : plan.slots.length - 1 - c))
    for (const c of order) {
      const wishes = plan.slots[c].map((slot) => wish(slot, forward))
      const fitted = fitColumn(
        wishes.map((w) => w.top),
        wishes.map((w) => w.weight),
        packed[c],
        rooms[c] - totals[c],
        rigid
      )
      plan.slots[c].forEach((slot, i) => {
        at(slot).top = fitted[i]
      })
    }
  }
  return at
}

/**
 * Where the columns start on the column axis. A gap between two columns holds
 * the turns of the back flows that leave the one and enter the other, and
 * what is left over is shared equally between the gaps. The waypoints of a
 * skipped column sit at the same start, so a straight run across it stays
 * level with the nodes.
 */
function columnStarts(maxColumn: number, axes: Axes, { space }: Solution) {
  const { nodeWidth } = axes
  const need = Array.from(
    { length: maxColumn },
    (_, g) => nodeWidth + 2 * axes.borderSpace + space.run + space.out[g] + space.into[g + 1]
  )
  const first = axes.uStart + axes.inset + axes.half + axes.edge(space.into[0])
  const last =
    axes.uStart +
    axes.columnLength +
    axes.inset +
    axes.half -
    axes.edge(space.out[maxColumn]) -
    nodeWidth
  const share = maxColumn ? Math.max(0, (last - first - sum(need)) / maxColumn) : 0
  const starts = [first]
  for (const gap of need) starts.push((starts.at(-1) as number) + gap + share)
  return starts
}

/**
 * A back flow runs from its source edge along its lane to its target edge:
 *
 *   source edge -> turn -> lane after the content -> turn -> target edge
 *
 * An empty flow has no loop and nothing to draw.
 */
function laneRoute(
  [source, target]: UW[],
  loop: Loop | undefined,
  wStart: number,
  factor: number,
  thickness: number
): Route {
  const t = loop?.t ?? 0
  const c1 = source.w + thickness / 2
  const c2 = target.w + thickness / 2
  const lane = loop ? wStart + loop.start + t / 2 : c1
  // the inner radius and half the thickness, unless there is not enough room across
  const clear = (loop?.clear ?? 0) * factor
  const radius = Math.max(0, Math.min(t / 2 + clear, (lane - c1) / 2, (lane - c2) / 2))
  const turn1 = source.u + radius + (loop?.out ?? 0)
  const turn2 = target.u - radius - (loop?.into ?? 0)
  return {
    points: [
      { u: source.u, w: c1 },
      { u: turn1, w: c1 },
      { u: turn1, w: lane },
      { u: turn2, w: lane },
      { u: turn2, w: c2 },
      { u: target.u, w: c2 },
    ],
    radius,
    t,
  }
}

export function computeGeometry(plan: Plan, input: GeometryInput): Geometry {
  const { area, borderWidth, insets, nodeWidth } = input
  // the axes, in (u, w): where the area starts and ends along the columns and across them
  const vertical = input.orientation === 'vertical'
  const [uStart, wStart] = vertical ? [area.top, area.left] : [area.left, area.top]
  const [uEnd, wEnd] = vertical ? [area.bottom, area.right] : [area.right, area.bottom]
  const rect = (u: number, w: number, du: number, dw: number): Rect =>
    vertical ? { height: du, width: dw, x: w, y: u } : { height: dw, width: du, x: u, y: w }
  // Whole pixels keep the bars on the pixel grid, which every browser rasterizes
  // alike; half a pixel would blur them differently from one browser to another.
  const half = Math.ceil(borderWidth / 2)
  const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0
  const axes: Axes = {
    borderSpace,
    columnLength: Math.max(0, uEnd - uStart - insets.start - insets.end - 2 * half),
    edge: (turn, own = turn) => (turn ? own + borderSpace : 0),
    half,
    inset: insets.start,
    nodeWidth,
    uStart,
    wExtent: Math.max(0, wEnd - wStart),
  }
  const items = plan.slots.map((column) =>
    column.map(
      (slot): Item => ({
        gap: slot.node && (input.gaps.get(slot.key) ?? { after: 0, before: 0 }),
        min: (slot.node && input.minSizes.get(slot.key)) || 0,
        size: slot.size,
      })
    )
  )

  const loops = buildLoops(plan)
  const solution = solve(plan, items, input.gaps, axes, loops)
  const { k } = solution
  const offsets = portOffsets(plan, k)
  const placed = placeSlots(
    plan,
    items,
    solution,
    axes.wExtent,
    offsets,
    input.paddingMode === 'even'
  )
  const starts = columnStarts(plan.maxColumn, axes, solution)
  placeLoops(
    loops,
    plan.slots.map((column) =>
      Math.max(0, ...column.map((slot) => placed(slot).top + placed(slot).bar))
    ),
    solution.factor
  )
  const loopOf = new Map(loops.map((loop) => [loop.link, loop]))

  const nodes = new Map<string, Rect>()
  for (const slot of plan.slots.flat()) {
    if (slot.node) {
      nodes.set(
        slot.key,
        rect(starts[slot.column], wStart + placed(slot).top, nodeWidth, placed(slot).bar)
      )
    }
  }

  const flows = plan.links.map((link): FlowRoute => {
    const thickness = k * link.flow
    // (u, w) of the anchors: where the band leaves a slot and where it enters the next
    const anchors: UW[] = []
    link.path.forEach((slot, j) => {
      const start = starts[slot.column]
      const edge = slot.node ? borderSpace : 0
      const w = wStart + (placed(slot).top + placed(slot).margin)
      if (j > 0) anchors.push({ u: start - edge, w: w + offsets.entry[link.index][j] })
      if (j < link.path.length - 1) {
        anchors.push({ u: start + nodeWidth + edge, w: w + offsets.exit[link.index][j] })
      }
    })
    const route: Route = link.back
      ? laneRoute(anchors, loopOf.get(link), wStart, solution.factor, thickness)
      : { points: anchors, t: thickness }
    const first = route.points[0]
    const last = route.points.at(-1) as UW
    const across = link.back ? route.t / 2 : 0
    const from = rect(first.u, first.w - across, 0, route.t)
    const to = rect(last.u, last.w - across, 0, 0)
    return { ...from, back: link.back, route, x2: to.x, y2: to.y }
  })

  return { flows, k, nodes }
}
