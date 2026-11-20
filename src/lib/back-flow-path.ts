/**
 * The route of a back flow, in an orientation independent coordinate system:
 * `u` runs along the columns and `w` across them. In a horizontal chart
 * u = x and w = y; in a vertical chart u = y and w = x.
 *
 *   source edge -> turn -> lane after the content -> turn -> target edge
 *
 * The band is a constant thickness stroke along the center line, so the route
 * is a short list of straight runs and quarter circles.
 */

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
  /** distance of the turns from the node edges, beyond the radius */
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
