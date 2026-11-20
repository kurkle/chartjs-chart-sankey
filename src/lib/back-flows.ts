import type { SankeyDataPoint, SankeyNode } from '../types.js'

/**
 * Back flows: flows whose target column is not after their source column
 * (this includes flows from a node to itself). They cannot be drawn between
 * the columns, so they are routed around the content instead:
 *
 *   source edge -> turn -> lane after the content -> turn -> target edge
 *
 * All geometry here is expressed in an orientation independent coordinate
 * system: `u` runs along the columns, `w` runs across them. In a horizontal
 * chart u = x and w = y; in a vertical chart u = y and w = x. The lanes are
 * always placed *after* the content on the w axis (below / to the right).
 */

/** Inner radius of the turns, in CSS pixels. */
export const BACK_FLOW_CORNER = 6
/**
 * Inner radius of the turns of a flow from a node to itself, in CSS pixels. The
 * loop wraps around a single node, so without this the band is much wider than
 * the hole it leaves and reads as a disc.
 */
export const BACK_FLOW_SELF_CORNER = 24
/**
 * Most lanes a chart may need. With more, the lanes would take over the chart
 * and nobody could follow a band through them, so the back flows are left to
 * the plain curve between the nodes instead.
 */
export const BACK_FLOW_MAX_LANES = 8
/**
 * Shortest distance from the content to the first lane, in CSS pixels. A turn
 * needs twice its inner radius of room across to keep that radius.
 */
export const BACK_FLOW_FIRST_GAP = 14
/** Distance between two lanes, in CSS pixels. */
export const BACK_FLOW_LANE_GAP = 6
/** Distance from the last lane to the end of the axis, in CSS pixels. */
export const BACK_FLOW_END_GAP = 4
/** Spare room kept between the outermost turn and the end of the axis, in CSS pixels. */
export const BACK_FLOW_EDGE_GAP = 2
/**
 * Least room kept between the nodes of two neighbouring columns, in CSS pixels,
 * for the flows between them and the turns of the back flows that are in the gap.
 */
export const BACK_FLOW_MIN_RUN = 40

export interface BackFlowLane {
  /** index of the flow in the dataset data */
  index: number
  /** flow value, which is also the lane thickness in value units */
  flow: number
  /** source column */
  from: number
  /** target column */
  to: number
  /** 0 is the innermost lane (closest to the content); loops that do not overlap share a lane */
  rank: number
  /** thickness of the lane in value units: the biggest flow in it */
  thickness: number
  /** sum of the thicknesses of all inner lanes */
  before: number
  /** inner radius of the turns, in CSS pixels */
  clear: number
  /** distance from the content to the inner edge of the lane, not counting the inner lanes, in CSS pixels */
  offset: number
  /** how much farther than the inner lanes the turns stick out from the node edges, in CSS pixels */
  lift: number
}

export interface BackFlowLayout {
  lanes: BackFlowLane[]
  /** value units added to the end of the cross axis for the lanes */
  reserve: number
  /** end of the content on the cross axis, in value units */
  content: number
  /** room the labels outside the first column take before it, in pixels */
  labelBefore: number
  /** room the labels outside the last column take after it, in pixels */
  labelAfter: number
}

export const NO_BACK_FLOWS: BackFlowLayout = {
  content: 0,
  labelAfter: 0,
  labelBefore: 0,
  lanes: [],
  reserve: 0,
}

const columnOf = (node: Pick<SankeyNode, 'x'>): number => node.x ?? 0

/** A flow is a back flow when it does not go to a later column. */
export const isBackFlow = (from: Pick<SankeyNode, 'x'>, to: Pick<SankeyNode, 'x'>): boolean =>
  columnOf(to) <= columnOf(from)

/** Inner radius of the turns of a back flow. */
export const backFlowClearance = (isSelfFlow: boolean): number =>
  isSelfFlow ? BACK_FLOW_SELF_CORNER : BACK_FLOW_CORNER

/**
 * Two loops can share a lane when there is a whole column between them, so
 * that their turns (which live in the gaps next to the columns) cannot meet.
 */
const loopsOverlap = (a: Pick<BackFlowLane, 'from' | 'to'>, b: Pick<BackFlowLane, 'from' | 'to'>) =>
  a.from + 1 >= b.to && b.from + 1 >= a.to

type Loop = Pick<BackFlowLane, 'clear' | 'flow' | 'from' | 'index' | 'to'>

/**
 * Assign every back flow a lane. Shortest loop (fewest columns spanned) goes
 * innermost so that nested loops do not cross each other; equal spans keep
 * the data order. A loop takes the innermost lane that has no overlapping
 * loop in it yet. Needs the columns to be known already. Returns no lanes at
 * all (the back flows are not routed) when more than BACK_FLOW_MAX_LANES are needed.
 */
export function planBackFlows(
  data: SankeyDataPoint[],
  nodes: Map<string, SankeyNode>
): BackFlowLane[] {
  const found: Loop[] = []
  data.forEach((point, index) => {
    const from = nodes.get(point.from)
    const to = nodes.get(point.to)
    if (!from || !to || Number.isNaN(point.flow) || point.flow <= 0 || !isBackFlow(from, to)) return
    found.push({
      clear: backFlowClearance(from === to),
      flow: point.flow,
      from: columnOf(from),
      index,
      to: columnOf(to),
    })
  })
  found.sort((a, b) => a.from - a.to - (b.from - b.to) || a.index - b.index)

  const levels: Loop[][] = []
  const ranks = found.map((loop) => {
    let rank = levels.findIndex((members) => !members.some((m) => loopsOverlap(m, loop)))
    if (rank < 0) rank = levels.push([]) - 1
    levels[rank].push(loop)
    return rank
  })
  if (levels.length > BACK_FLOW_MAX_LANES) return []

  const thickness = levels.map((members) => Math.max(...members.map((m) => m.flow)))
  const clear = levels.map((members) => Math.max(...members.map((m) => m.clear)))
  // An outer lane's turns must clear the hole of the lane inside it.
  const lift: number[] = []
  const before: number[] = []
  levels.forEach((_, rank) => {
    lift[rank] =
      rank === 0
        ? 0
        : lift[rank - 1] + BACK_FLOW_LANE_GAP + Math.max(0, clear[rank - 1] - clear[rank])
    before[rank] = rank === 0 ? 0 : before[rank - 1] + thickness[rank - 1]
  })
  const firstGap = Math.max(BACK_FLOW_FIRST_GAP, 2 * (clear[0] ?? 0))
  return found.map((loop, i) => ({
    ...loop,
    before: before[ranks[i]],
    lift: lift[ranks[i]],
    offset: firstGap + lift[ranks[i]],
    rank: ranks[i],
    thickness: thickness[ranks[i]],
  }))
}

/**
 * Value units to add to the cross axis so that all lanes fit after the
 * content. Lane thickness is in value units (it scales with the axis), the
 * gaps are in pixels, so the units per pixel depend on the result:
 *   R = F + G * (C + R) / H   =>   R = (F + G * C / H) / (1 - G / H)
 * @param content - end of the content on the cross axis, in value units
 * @param axisLength - length of the cross axis in pixels
 */
export function reserveBackFlowSpace(
  lanes: BackFlowLane[],
  content: number,
  axisLength: number
): number {
  if (!lanes.length) return 0
  const outer = lanes.reduce((best, lane) => (lane.rank > best.rank ? lane : best), lanes[0])
  const flows = outer.before + outer.thickness
  const gaps = outer.offset + BACK_FLOW_END_GAP
  const share = Math.min(gaps / Math.max(axisLength, 1), 0.5)
  return (flows + share * content) / (1 - share)
}

/** Distance in pixels the turns of the lane stick out from the node edge. */
export const laneReach = (lane: BackFlowLane, pixelsPerUnit: number): number =>
  lane.before * pixelsPerUnit + lane.lift

/**
 * Cross axis position of the lane center, in pixels. Lanes start after the
 * content, the innermost first.
 * @param contentEnd - pixel of the end of the content on the cross axis
 */
export const laneCenter = (lane: BackFlowLane, contentEnd: number, pixelsPerUnit: number): number =>
  contentEnd + lane.offset + lane.before * pixelsPerUnit + (lane.thickness * pixelsPerUnit) / 2

/**
 * How far the vertical run of the turns of a lane reaches from the node edge,
 * to the outer edge of the band, in pixels.
 */
const turnExtent = (lane: BackFlowLane, pixelsPerUnit: number): number =>
  lane.flow * pixelsPerUnit + lane.clear + laneReach(lane, pixelsPerUnit) + BACK_FLOW_EDGE_GAP

/** What the layout knows about the axis the columns are spread over. */
export interface ColumnAxis {
  /** pixels from the end of the axis to the start of the last column, when there are no back flows */
  padding: number
  nodeWidth: number
  /** room the border of a node takes on each side, in pixels */
  borderSpace: number
  /** room the labels outside the first column take before it, and those outside the last one after it, in pixels */
  labelBefore: number
  labelAfter: number
}

export interface ColumnSpace {
  /** room taken from the start of the column axis, in pixels */
  lead: number
  /** room taken from the end of the column axis, in pixels */
  padding: number
  /** least distance between the starts of two neighbouring columns, in pixels */
  spacing: number
}

/**
 * Room the back flows need along the column axis, in pixels: before the first
 * column and after the last one, and in each gap between two columns. They are
 * measured from the node edges to the outer edge of the bands.
 */
export function columnSpace(
  lanes: BackFlowLane[],
  lastColumn: number,
  pixelsPerUnit: number,
  axis: ColumnAxis
): ColumnSpace {
  const { borderSpace, nodeWidth } = axis
  // the room each column needs after it (turns of the flows that leave it) and before it
  const out = new Array<number>(lastColumn + 1).fill(0)
  const into = new Array<number>(lastColumn + 1).fill(0)
  for (const lane of lanes) {
    const extent = turnExtent(lane, pixelsPerUnit)
    out[lane.from] = Math.max(out[lane.from], extent)
    into[lane.to] = Math.max(into[lane.to], extent)
  }
  let gap = 0
  for (let k = 0; k < lastColumn; k++) {
    gap = Math.max(gap, out[k] + into[k + 1])
  }
  return {
    lead: into[0] ? into[0] + borderSpace + axis.labelBefore : 0,
    padding: out[lastColumn]
      ? Math.max(axis.padding, nodeWidth + borderSpace + out[lastColumn] + axis.labelAfter)
      : axis.padding,
    spacing: nodeWidth + 2 * borderSpace + Math.max(BACK_FLOW_MIN_RUN, gap),
  }
}

/**
 * The most pixels a value unit may take on the cross axis so that the turns
 * and the columns still fit on the column axis. The room the turns need grows
 * with the thickness of the bands, so on a short column axis the chart cannot
 * fill a long cross axis.
 * @param limit - pixels per unit without the limit
 * @param length - length of the column axis in pixels
 * @returns the limit, or 0 when not even hairline bands fit
 */
export function fitPixelsPerUnit(
  lanes: BackFlowLane[],
  lastColumn: number,
  limit: number,
  axis: ColumnAxis,
  length: number
): number {
  const needed = (pixelsPerUnit: number) => {
    const { lead, padding, spacing } = columnSpace(lanes, lastColumn, pixelsPerUnit, axis)
    return lead + padding + lastColumn * spacing
  }
  if (needed(limit) <= length) return limit
  if (needed(0) > length) return 0

  let low = 0
  let high = limit
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (needed(mid) <= length) {
      low = mid
    } else {
      high = mid
    }
  }
  return low
}

export interface BackFlowShape {
  /** source edge on the column axis */
  u1: number
  /** target edge on the column axis */
  u2: number
  /** center of the band at the source, on the cross axis */
  c1: number
  /** center of the band at the target, on the cross axis */
  c2: number
  /** center of the lane, on the cross axis */
  lane: number
  /** distance of the turns from the node edges, see `laneReach` */
  reach: number
  /** inner radius of the turns */
  clear: number
  /** band thickness */
  t: number
}

export interface UW {
  u: number
  w: number
}

export interface BackFlowPath {
  /** corner points of the center line: stub, turn, lane, turn, stub */
  points: UW[]
  /** radius of the turns */
  radius: number
}

export function backFlowPath(s: BackFlowShape): BackFlowPath {
  const radius = Math.max(0, Math.min(s.t / 2 + s.clear, (s.lane - s.c1) / 2, (s.lane - s.c2) / 2))
  const turn1 = s.u1 + radius + s.reach
  const turn2 = s.u2 - radius - s.reach
  return {
    points: [
      { u: s.u1, w: s.c1 },
      { u: turn1, w: s.c1 },
      { u: turn1, w: s.lane },
      { u: turn2, w: s.lane },
      { u: turn2, w: s.c2 },
      { u: s.u2, w: s.c2 },
    ],
    radius,
  }
}

const dist = (a: UW, b: UW) => Math.hypot(b.u - a.u, b.w - a.w)

export interface LinePart {
  type: 'line'
  from: UW
  to: UW
}

export interface ArcPart {
  type: 'arc'
  center: UW
  radius: number
  /** angle of the start point and the (signed) sweep, in radians */
  start: number
  sweep: number
}

/**
 * The center line as straight runs and quarter circles (the turns). Runs
 * that would have no length are left out.
 */
export function backFlowParts({ points, radius }: BackFlowPath): Array<LinePart | ArcPart> {
  const parts: Array<LinePart | ArcPart> = []
  let at = points[0]
  const lineTo = (to: UW) => {
    if (dist(at, to) > 1e-9) parts.push({ from: at, to, type: 'line' })
    at = to
  }
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const l1 = dist(prev, corner) || 1
    const l2 = dist(corner, next) || 1
    const d1 = { u: (corner.u - prev.u) / l1, w: (corner.w - prev.w) / l1 }
    const d2 = { u: (next.u - corner.u) / l2, w: (next.w - corner.w) / l2 }
    const start = { u: corner.u - d1.u * radius, w: corner.w - d1.w * radius }
    const end = { u: corner.u + d2.u * radius, w: corner.w + d2.w * radius }
    lineTo(start)
    if (radius > 0) {
      const center = { u: start.u + d2.u * radius, w: start.w + d2.w * radius }
      // a turn is always a quarter circle, to the side the direction changes to
      const sweep = Math.sign(d1.u * d2.w - d1.w * d2.u) * (Math.PI / 2)
      parts.push({
        center,
        radius,
        start: Math.atan2(start.w - center.w, start.u - center.u),
        sweep,
        type: 'arc',
      })
      at = end
    }
  }
  lineTo(points.at(-1) as UW)
  return parts
}

/** Length of the center line (with rounded turns). */
export const backFlowLength = (path: BackFlowPath): number =>
  backFlowParts(path).reduce(
    (sum, part) =>
      sum + (part.type === 'line' ? dist(part.from, part.to) : Math.abs(part.sweep) * part.radius),
    0
  )

function onLine(p: UW, { from, to }: LinePart, halfWidth: number): boolean {
  const du = to.u - from.u
  const dw = to.w - from.w
  const len2 = du * du + dw * dw
  const along = ((p.u - from.u) * du + (p.w - from.w) * dw) / len2
  if (along < 0 || along > 1) return false
  return Math.hypot(p.u - (from.u + along * du), p.w - (from.w + along * dw)) <= halfWidth
}

function onArc(p: UW, arc: ArcPart, halfWidth: number): boolean {
  const du = p.u - arc.center.u
  const dw = p.w - arc.center.w
  if (Math.abs(Math.hypot(du, dw) - arc.radius) > halfWidth) return false
  // angle travelled from the start of the arc, in the direction of the sweep
  const TAU = 2 * Math.PI
  const travelled = ((Math.atan2(dw, du) - arc.start) * Math.sign(arc.sweep) + 2 * TAU) % TAU
  return travelled <= Math.abs(arc.sweep)
}

/**
 * True when the point is on the band. The band is the center line (see
 * `backFlowParts`) with half the thickness to each side and butt ends, so
 * the test is exact: the same area the stroke paints.
 */
export function isOnBackFlow(p: UW, s: BackFlowShape): boolean {
  const halfWidth = s.t / 2
  return backFlowParts(backFlowPath(s)).some((part) =>
    part.type === 'line' ? onLine(p, part, halfWidth) : onArc(p, part, halfWidth)
  )
}

/** Bounding box of the band. */
export function backFlowBounds(s: BackFlowShape): {
  uMin: number
  uMax: number
  wMin: number
  wMax: number
} {
  const { points } = backFlowPath(s)
  return {
    uMax: points[1].u + s.t / 2,
    uMin: points[4].u - s.t / 2,
    wMax: s.lane + s.t / 2,
    wMin: Math.min(s.c1, s.c2) - s.t / 2,
  }
}
