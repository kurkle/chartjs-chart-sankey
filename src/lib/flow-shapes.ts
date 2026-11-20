import type { BandRoute, LaneRoute, Route, UW } from '../types.js'
import type { Frame } from './route.js'

import {
  backFlowBounds,
  backFlowLength,
  backFlowParts,
  backFlowPath,
  isOnParts,
} from './back-flow-path.js'

/**
 * The two shapes a flow can have, worked out from its route in (u, w): a band
 * through its anchor points for forward flows and a stroked band along a lane
 * for back flows. Both answer the same questions, so the element only has to
 * pick one. The frame maps to the canvas where something is drawn, and maps
 * the mouse into (u, w) where something is tested.
 */

/** A rectangle in (u, w): its corner and its extent along u and across. */
export interface UWRect {
  u: number
  w: number
  du: number
  dw: number
}

export interface FlowShape {
  /** Draws the band, revealed to `progress` along the columns (back flows: along their length) */
  draw(ctx: CanvasRenderingContext2D, progress: number): void
  contains(p: UW): boolean
  /** The rectangle that holds the band */
  box(): UWRect
  center(): UW
  /** The area the value label sits in */
  labelRect(): UWRect
}

const pointInLine = (p1: UW, p2: UW, t: number): UW => ({
  u: p1.u + t * (p2.u - p1.u),
  w: p1.w + t * (p2.w - p1.w),
})

/** Control points of the curve between two columns; the target is always in a later column. */
const controlPoints = (a: UW, b: UW) => ({
  cp1: { u: a.u + ((b.u - a.u) / 3) * 2, w: a.w },
  cp2: { u: a.u + (b.u - a.u) / 3, w: b.w },
})

// -- forward flows ----------------------------------------------------------

/** The segments of a band alternate: a curve, then a straight run across a skipped column. */
const isCurve = (segment: number) => segment % 2 === 0

/** Where the top edge of the band is at the given position along the columns, if it is there. */
function bandEdgeAt(points: UW[], along: number): number | undefined {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (along < a.u || along > b.u) continue
    if (!isCurve(i)) return a.w
    const { cp1, cp2 } = controlPoints(a, b)
    const t = (along - a.u) / (b.u - a.u || 1)
    const ab = pointInLine(a, cp1, t)
    const bc = pointInLine(cp1, cp2, t)
    const cd = pointInLine(cp2, b, t)
    return pointInLine(pointInLine(ab, bc, t), pointInLine(bc, cd, t), t).w
  }
  return undefined
}

/** The curve that runs the longest along the columns: the room for the label. */
function longestCurve(points: UW[]) {
  let best = 0
  for (let i = 2; i < points.length - 1; i += 2) {
    if (points[i + 1].u - points[i].u > points[best + 1].u - points[best].u) best = i
  }
  return [points[best], points[best + 1]] as const
}

function bandShape({ points, t }: BandRoute, frame: Frame): FlowShape {
  const first = points[0]
  const last = points.at(-1) as UW
  const wMin = Math.min(...points.map((p) => p.w))
  const wMax = Math.max(...points.map((p) => p.w))
  const at = (p: UW, across = 0) => frame.point(p.u, p.w + across)

  function trace(ctx: CanvasRenderingContext2D) {
    const start = at(first)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    for (let i = 0; i < points.length - 1; i++) {
      const to = at(points[i + 1])
      if (isCurve(i)) {
        const { cp1, cp2 } = controlPoints(points[i], points[i + 1])
        const c1 = at(cp1)
        const c2 = at(cp2)
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y)
      } else {
        ctx.lineTo(to.x, to.y)
      }
    }
    const end = at(last, t)
    ctx.lineTo(end.x, end.y)
    for (let i = points.length - 2; i >= 0; i--) {
      const to = at(points[i], t)
      if (isCurve(i)) {
        const { cp1, cp2 } = controlPoints(points[i], points[i + 1])
        const c1 = at(cp1, t)
        const c2 = at(cp2, t)
        ctx.bezierCurveTo(c2.x, c2.y, c1.x, c1.y, to.x, to.y)
      } else {
        ctx.lineTo(to.x, to.y)
      }
    }
    ctx.lineTo(start.x, start.y)
  }

  return {
    box: () => ({ du: last.u - first.u, dw: wMax - wMin + t, u: first.u, w: wMin }),
    center() {
      // the middle of the band along the columns, which is on the band
      const along = (first.u + last.u) / 2
      return { u: along, w: (bandEdgeAt(points, along) ?? first.w) + t / 2 }
    },
    contains({ u, w }) {
      if (u < first.u || u > last.u) return false
      const edge = bandEdgeAt(points, u)
      return edge !== undefined && w >= edge && w <= edge + t
    },
    draw(ctx, progress) {
      if (progress < 1) {
        const r = frame.rect(first.u, wMin, (last.u - first.u) * progress + 1, wMax - wMin + t + 1)
        ctx.beginPath()
        ctx.rect(r.x, r.y, r.width, r.height)
        ctx.clip()
      }
      trace(ctx)
      ctx.stroke()
      ctx.closePath()
      ctx.fill()
    },
    labelRect() {
      const [a, b] = longestCurve(points)
      return { du: b.u - a.u, dw: Math.abs(b.w - a.w) + t, u: a.u, w: Math.min(a.w, b.w) }
    },
  }
}

// -- back flows -------------------------------------------------------------

function laneShape(route: LaneRoute, frame: Frame): FlowShape {
  const { t } = route
  // the center line, worked out when it is first needed
  let path: ReturnType<typeof backFlowPath> | undefined
  let parts: ReturnType<typeof backFlowParts> | undefined
  const line = () => {
    path ??= backFlowPath(route)
    return path
  }

  return {
    box() {
      const { uMax, uMin, wMax, wMin } = backFlowBounds(route)
      return { du: uMax - uMin, dw: wMax - wMin, u: uMin, w: wMin }
    },
    center() {
      // middle of the straight run along the lane, which is on the band
      const { points } = line()
      return { u: (points[2].u + points[3].u) / 2, w: route.lane }
    },
    contains: (p) => {
      parts ??= backFlowParts(line())
      return isOnParts(p, parts, t / 2)
    },
    // A constant thickness band is stroked, and revealed along its length with a dash.
    draw(ctx, progress) {
      const { points, radius } = line()
      const [start, ...rest] = points.map((p) => frame.point(p.u, p.w))
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      for (let i = 0; i < rest.length - 1; i++) {
        ctx.arcTo(rest[i].x, rest[i].y, rest[i + 1].x, rest[i + 1].y, radius)
      }
      const end = rest.at(-1) as { x: number; y: number }
      ctx.lineTo(end.x, end.y)
      ctx.lineWidth = t
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'round'
      if (progress < 1) {
        const length = backFlowLength(line())
        ctx.setLineDash([length * progress, length + 1])
      }
      ctx.stroke()
    },
    labelRect() {
      const { points } = line()
      const u = Math.min(points[2].u, points[3].u)
      return { du: Math.abs(points[2].u - points[3].u), dw: t, u, w: route.lane - t / 2 }
    },
  }
}

export function shapeOf(route: Route, frame: Frame): FlowShape {
  return route.kind === 'lane' ? laneShape(route, frame) : bandShape(route, frame)
}
