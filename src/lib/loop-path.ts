/**
 * The centre line of a back flow (see `LoopRoute` in types.ts): straight runs
 * along and across the columns whose corners are rounded. The band is a
 * constant thickness stroke along the line, so it is a short list of straight
 * runs and quarter circles.
 */

import type { LoopVertex, UW } from '../types.js'

const dist = (a: UW, b: UW) => Math.hypot(b.u - a.u, b.w - a.w)

/**
 * Cleans the corners of a centre line: a vertex that repeats the one before or
 * lies on a straight run is dropped, and the radius of every corner is cut
 * to what its two runs leave it (a run between two rounded corners gives each
 * half of it, a run that starts or ends the line all of it).
 */
export function fitRadii(points: readonly LoopVertex[]): LoopVertex[] {
  let kept = [...points]
  for (;;) {
    const apart = kept.filter((p, i) => i === 0 || dist(kept[i - 1], p) > 1e-9)
    const next = apart.filter((p, i) => {
      if (i === 0 || i === apart.length - 1) return true
      const [a, b] = [apart[i - 1], apart[i + 1]]
      return Math.abs((p.u - a.u) * (b.w - p.w) - (p.w - a.w) * (b.u - p.u)) > 1e-9
    })
    // dropping a vertex can make two others collinear or equal, so go on until nothing changes
    if (next.length === kept.length) break
    kept = next
  }
  const last = kept.length - 1
  return kept.map((p, i) => {
    if (i === 0 || i === last) return { ...p, r: 0 }
    const share = (other: number) => dist(p, kept[other]) / (other === 0 || other === last ? 1 : 2)
    return { ...p, r: Math.max(0, Math.min(p.r, share(i - 1), share(i + 1))) }
  })
}

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
 * The centre line as straight runs and quarter circles (the corners). Runs
 * that would have no length are left out.
 */
export function loopParts(points: readonly LoopVertex[]): Array<LinePart | ArcPart> {
  const parts: Array<LinePart | ArcPart> = []
  if (points.length < 2) return parts
  let at: UW = points[0]
  const lineTo = (to: UW) => {
    if (dist(at, to) > 1e-9) parts.push({ from: at, to, type: 'line' })
    at = to
  }
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const { r } = corner
    const l1 = dist(prev, corner) || 1
    const l2 = dist(corner, next) || 1
    const d1 = { u: (corner.u - prev.u) / l1, w: (corner.w - prev.w) / l1 }
    const d2 = { u: (next.u - corner.u) / l2, w: (next.w - corner.w) / l2 }
    const start = { u: corner.u - d1.u * r, w: corner.w - d1.w * r }
    const end = { u: corner.u + d2.u * r, w: corner.w + d2.w * r }
    lineTo(start)
    if (r > 0) {
      const center = { u: start.u + d2.u * r, w: start.w + d2.w * r }
      // a corner is always a quarter circle, to the side the direction changes to
      const sweep = Math.sign(d1.u * d2.w - d1.w * d2.u) * (Math.PI / 2)
      parts.push({
        center,
        radius: r,
        start: Math.atan2(start.w - center.w, start.u - center.u),
        sweep,
        type: 'arc',
      })
      at = end
    }
  }
  lineTo(points.at(-1) as LoopVertex)
  return parts
}

/** Length of the centre line (with rounded corners). */
export const loopLength = (parts: Array<LinePart | ArcPart>): number =>
  parts.reduce(
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
 * True when the point is on the band: the centre line with half the thickness
 * to each side and butt ends, so the test is exact, the same area the stroke
 * paints.
 */
export function isOnParts(p: UW, parts: Array<LinePart | ArcPart>, halfWidth: number): boolean {
  return parts.some((part) =>
    part.type === 'line' ? onLine(p, part, halfWidth) : onArc(p, part, halfWidth)
  )
}

/** Bounding box of the band. */
export function loopBounds(points: readonly LoopVertex[], t: number) {
  return {
    uMax: Math.max(...points.map((p) => p.u)) + t / 2,
    uMin: Math.min(...points.map((p) => p.u)) - t / 2,
    wMax: Math.max(...points.map((p) => p.w)) + t / 2,
    wMin: Math.min(...points.map((p) => p.w)) - t / 2,
  }
}

/** The longest straight run along the columns, which is where the label goes; none when the line has no such run. */
export function longestRun(points: readonly LoopVertex[]): [UW, UW] | undefined {
  let best: [UW, UW] | undefined
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]]
    if (a.w !== b.w) continue
    if (!best || Math.abs(b.u - a.u) > Math.abs(best[1].u - best[0].u)) best = [a, b]
  }
  return best
}
