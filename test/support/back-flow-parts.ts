/** Test helpers: the center line of a back flow route as straight runs and quarter circles. */
import type { Route, UW } from '../../src/types.js'

export type BackFlowPath = Pick<Route, 'points'> & { radius: number }

export const backFlowPath = (route: Route) => route as BackFlowPath

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

/** The same for parts that are already worked out. */
export function isOnParts(p: UW, parts: Array<LinePart | ArcPart>, halfWidth: number): boolean {
  return parts.some((part) =>
    part.type === 'line' ? onLine(p, part, halfWidth) : onArc(p, part, halfWidth)
  )
}

/** Bounding box of the band. */
export function backFlowBounds({ points, t }: Route) {
  return {
    uMax: points[1].u + t / 2,
    uMin: points[4].u - t / 2,
    wMax: points[2].w + t / 2,
    wMin: Math.min(points[0].w, points[5].w) - t / 2,
  }
}
