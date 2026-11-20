import type { SankeyNodeGap, SankeyOrientation } from '../types.js'
import type { Extent, LaneSpace } from './lane-space.js'
import type { Plan, PlanLink } from './topology.js'

import {
  clearanceOf,
  floor,
  MIN_THICKNESS,
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
  /** A back flow: drawn as a band around the content, see back-flow-path.ts */
  back: boolean
  /** Inner radius of the turns of a back flow */
  clear: number
  height: number
  /** Center of the lane on the cross axis, in x or y */
  lane: number
  /** How far the turns stick out from the node edges, beyond their radius */
  reach: number
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

interface Axes {
  /** Length of the column axis available to the columns and the turns */
  columnLength: number
  /** Start of the column axis and the cross axis, and the length of the latter */
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
  /** Factor applied to the lanes' and turns' fixed pixels, never above `gapFactor` */
  factor: number
  k: number
  /** The column axis set the scale, so the cross axis is not filled */
  limited: boolean
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
 * the cross axis (nodes, gaps and the lanes after them) and the column axis
 * holds the columns and the turns of the back flows. Fixed pixels that do not
 * fit shrink by one common factor: the gaps, the lanes and the turns may take
 * half of what is left on their axis.
 */
function solve(plan: Plan, input: GeometryInput, axes: Axes, space: LaneSpace): Solution {
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
  const gapTotals = slots.map((column) => sum(gapsOf(column)))
  const widestGaps = Math.max(0, ...gapTotals)
  const crossFixed = widestGaps + floor(space.cross)
  const gapFactor = crossFixed > 0 ? Math.min(1, (MAX_GAP_SHARE * axes.wExtent) / crossFixed) : 1

  const along = columnBudget(space)
  const nodesLength =
    (plan.maxColumn + 1) * input.nodeWidth + 2 * axes.borderSpace * plan.maxColumn + along.rigid
  const free = axes.columnLength - nodesLength
  const alongFloor = floor(along)
  const turnsFactor =
    alongFloor > 0 ? Math.min(1, Math.max(0, (MAX_GAP_SHARE * free) / alongFloor)) : 1
  const factor = Math.min(gapFactor, turnsFactor)

  const alongK = solveScale(shrinkTerms(along.terms, factor), free - factor * along.shrinkable)
  let k = Number.POSITIVE_INFINITY
  slots.forEach((column, c) => {
    // the free space above the last node of the column scales with the flows
    const last = plan.columns[c].at(-1)
    const slack = last ? (plan.offsets.get(last.key) ?? 0) : 0
    const extra = last ? extraAbove(plan, input, last.key) * gapFactor : 0
    const available =
      axes.wExtent -
      gapTotals[c] * gapFactor -
      extra -
      space.cross.rigid -
      factor * space.cross.shrinkable
    const terms = [...column, ...shrinkTerms(space.cross.terms, factor)]
    k = Math.min(k, solveScale(terms, available, slack))
  })
  const limited = alongK < k
  k = Math.min(k, alongK)
  return { factor, gapFactor, k: Number.isFinite(k) ? k : 0, limited, slots }
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
function placeNodes(plan: Plan, input: GeometryInput, solution: Solution, extent: number) {
  const { gapFactor, k } = solution
  const tops = new Map<string, number>()
  const natural = (key: string) => k * (plan.nodes.get(key)?.size ?? 0)
  const slotOf = (key: string) => Math.max(natural(key), input.minSizes.get(key) ?? 0)
  const naturalTop = (key: string) => (tops.get(key) as number) + (slotOf(key) - natural(key)) / 2

  plan.columns.forEach((nodes, c) => {
    const spacing = gapsOf(solution.slots[c]).map((gap) => gap * gapFactor)
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
        extraAbove(plan, input, node.key) * gapFactor
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

/**
 * Where the columns start on the column axis. A gap between two columns holds
 * the turns of the back flows that leave the one and enter the other, and
 * what is left over is shared equally between the gaps.
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

/** What the routes of the back flows need to know about the lanes, in pixels. */
interface LanePositions {
  /** center of each lane on the cross axis, relative to the start of the axis */
  centers: number[]
  /** how far the turns of each lane stick out from the node edges */
  reaches: number[]
  /** end of the last lane, and the gap after it */
  end: number
}

function placeLanes(space: LaneSpace, { factor, k }: Solution, contentEnd: number): LanePositions {
  let top = contentEnd + factor * space.firstGap
  const centers: number[] = []
  const reaches: number[] = []
  space.lanes.forEach((lane) => {
    const before = sum(lane.before.map((term) => termPixels(term, k, factor)))
    const thickness = termPixels(lane.thickness, k, factor)
    reaches.push(factor * lane.lift + before)
    centers.push(top + factor * lane.lift + before + thickness / 2)
  })
  const outer = space.lanes.at(-1)
  if (outer) {
    top += factor * outer.lift + sum(space.cross.terms.map((term) => termPixels(term, k, factor)))
  }
  return { centers, end: space.lanes.length ? top + factor * space.endGap : contentEnd, reaches }
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
  const { factor, k } = solution
  const offsets = portOffsets(plan, k)
  const content = axes.wExtent - measure(space.cross, k, factor)
  const { naturalTop, slotOf, tops } = placeNodes(plan, input, solution, content)
  const starts = columnStarts(plan, input, axes, space, solution)

  // The lanes follow the content; the whole is centered on the cross axis.
  const contentEnd = Math.max(
    0,
    ...[...plan.nodes.keys()].map((key) => (tops.get(key) ?? 0) + slotOf(key))
  )
  const lanes = placeLanes(space, solution, contentEnd)
  const shift = solution.limited ? Math.floor(Math.max(0, axes.wExtent - lanes.end) / 2) : 0

  const nodes = new Map<string, Rect>()
  for (const node of plan.nodes.values()) {
    const top = wStart + shift + (tops.get(node.key) ?? 0)
    nodes.set(node.key, toRect(orientation, starts[node.x ?? 0], top, nodeWidth, slotOf(node.key)))
  }

  const flows = plan.links.map((link): FlowRoute => {
    const u = starts[link.from.x ?? 0] + nodeWidth + borderSpace
    const u2 = starts[link.to.x ?? 0] - borderSpace
    const w = wStart + shift + naturalTop(link.from.key) + offsets.outOffset[link.index]
    const w2 = wStart + shift + naturalTop(link.to.key) + offsets.inOffset[link.index]
    const thickness = k * link.flow
    if (link.back) {
      return backRoute(link, {
        lanes,
        offsetW: wStart + shift,
        orientation,
        solution,
        thickness,
        u,
        u2,
        w,
        w2,
      })
    }
    const from = toXY(orientation, u, w)
    const to = toXY(orientation, u2, w2)
    return {
      back: false,
      clear: 0,
      height: vertical ? 0 : thickness,
      lane: 0,
      reach: 0,
      width: vertical ? thickness : 0,
      x: from.x,
      x2: to.x,
      y: from.y,
      y2: to.y,
    }
  })

  return { flows, k, nodes }
}

interface BackRouteInput {
  lanes: LanePositions
  offsetW: number
  orientation: SankeyOrientation
  solution: Solution
  thickness: number
  u: number
  u2: number
  w: number
  w2: number
}

/** A back flow runs from its source edge along its lane to its target edge. */
function backRoute(link: PlanLink, input: BackRouteInput): FlowRoute {
  const { lanes, offsetW, orientation, solution, thickness, u, u2, w, w2 } = input
  const vertical = orientation === 'vertical'
  const drawn = link.lane >= 0 ? Math.max(thickness, MIN_THICKNESS * solution.factor) : 0
  const c1 = w + thickness / 2
  const c2 = w2 + thickness / 2
  const from = toXY(orientation, u, c1 - drawn / 2)
  const to = toXY(orientation, u2, c2 - drawn / 2)
  const lane = link.lane >= 0 ? offsetW + lanes.centers[link.lane] : c1
  return {
    back: true,
    clear: clearanceOf(link) * solution.factor,
    height: vertical ? 0 : drawn,
    lane,
    reach: link.lane >= 0 ? lanes.reaches[link.lane] : 0,
    width: vertical ? drawn : 0,
    x: from.x,
    x2: to.x,
    y: from.y,
    y2: to.y,
  }
}
