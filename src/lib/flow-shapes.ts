import type { FlowPoint, SankeyOrientation } from '../types.js'
import type { BackFlowShape, UW } from './back-flow-path.js'

import { backFlowBounds, backFlowLength, backFlowPath, isOnBackFlow } from './back-flow-path.js'

/**
 * The two shapes a flow can have. A forward flow is a band through its anchor
 * points: a curve between neighbouring columns and, when it skips columns, a
 * straight run across each skipped one. A back flow is a band of constant
 * thickness along a lane after the content. Both answer the same questions, so
 * the element only has to pick one.
 */

/** What a shape is made from: the properties of the flow element. */
export interface ShapeProps {
  clear: number
  height: number
  lane: number
  orientation: SankeyOrientation
  /** anchor points of a forward flow that skips columns; the others have `x, y` and `x2, y2` */
  points?: FlowPoint[]
  reach: number
  /** the same at the target end of a back flow */
  reach2: number
  width: number
  x: number
  x2: number
  y: number
  y2: number
}

export interface Box {
  xMax: number
  xMin: number
  yMax: number
  yMin: number
}

export interface FlowShape {
  /** Draws the band, revealed to `progress` along the columns (back flows: along their length) */
  draw(ctx: CanvasRenderingContext2D, progress: number): void
  contains(x: number, y: number): boolean
  box(): Box
  center(): FlowPoint
  /** The area the value label sits in */
  labelRect(): { height: number; width: number; x: number; y: number }
}

export const pointInLine = (p1: FlowPoint, p2: FlowPoint, t: number): FlowPoint => ({
  x: p1.x + t * (p2.x - p1.x),
  y: p1.y + t * (p2.y - p1.y),
})

/** Control points of the curve between two columns; the target is always in a later column. */
export const controlPoints = (
  x: number,
  y: number,
  x2: number,
  y2: number,
  orientation: SankeyOrientation
) =>
  orientation === 'vertical'
    ? { cp1: { x, y: y + ((y2 - y) / 3) * 2 }, cp2: { x: x2, y: y + (y2 - y) / 3 } }
    : { cp1: { x: x + ((x2 - x) / 3) * 2, y }, cp2: { x: x + (x2 - x) / 3, y: y2 } }

/** Interpolates the anchor points of a flow that skips columns, for the animations. */
export function interpolatePoints(
  from: FlowPoint[] | undefined,
  to: FlowPoint[] | undefined,
  factor: number
): FlowPoint[] | undefined {
  if (!from || !to || from.length !== to.length) {
    return !from || factor > 0.5 ? to : from
  }
  return to.map((point, i) => ({
    x: from[i].x + (point.x - from[i].x) * factor,
    y: from[i].y + (point.y - from[i].y) * factor,
  }))
}

// -- forward flows ----------------------------------------------------------

/** The segments of a band alternate: a curve, then a straight run across a skipped column. */
const isCurve = (segment: number) => segment % 2 === 0

/** Where the top (left) edge of the band is at the given position along the columns, if it is there. */
function bandEdgeAt(points: FlowPoint[], along: number, orientation: SankeyOrientation) {
  const vertical = orientation === 'vertical'
  const u = (p: FlowPoint) => (vertical ? p.y : p.x)
  const w = (p: FlowPoint) => (vertical ? p.x : p.y)
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (along < u(a) || along > u(b)) continue
    if (!isCurve(i)) return w(a)
    const { cp1, cp2 } = controlPoints(a.x, a.y, b.x, b.y, orientation)
    const t = (along - u(a)) / (u(b) - u(a) || 1)
    const ab = pointInLine(a, cp1, t)
    const bc = pointInLine(cp1, cp2, t)
    const cd = pointInLine(cp2, b, t)
    return w(pointInLine(pointInLine(ab, bc, t), pointInLine(bc, cd, t), t))
  }
  return undefined
}

/** The curve that runs the longest along the columns: the room for the label. */
function longestCurve(points: FlowPoint[], orientation: SankeyOrientation) {
  const along = (p: FlowPoint) => (orientation === 'vertical' ? p.y : p.x)
  let best = 0
  for (let i = 2; i < points.length - 1; i += 2) {
    if (along(points[i + 1]) - along(points[i]) > along(points[best + 1]) - along(points[best])) {
      best = i
    }
  }
  return [points[best], points[best + 1]] as const
}

export function bandShape(props: ShapeProps): FlowShape {
  const { height, orientation, width, x, x2, y, y2 } = props
  const vertical = orientation === 'vertical'
  const points = props.points ?? [
    { x, y },
    { x: x2, y: y2 },
  ]
  const thickness = vertical ? width : height
  const offset = vertical ? { x: thickness, y: 0 } : { x: 0, y: thickness }
  const last = points.length - 1

  return {
    box() {
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      return {
        xMax: Math.max(...xs) + (vertical ? width : 0),
        xMin: Math.min(...xs),
        yMax: Math.max(...ys) + (vertical ? 0 : height),
        yMin: Math.min(...ys),
      }
    },
    center() {
      // the middle of the band along the columns, which is on the band
      const along = (vertical ? y + y2 : x + x2) / 2
      const edge = bandEdgeAt(points, along, orientation) ?? (vertical ? x : y)
      return vertical ? { x: edge + width / 2, y: along } : { x: along, y: edge + height / 2 }
    },
    contains(mouseX, mouseY) {
      if (vertical ? mouseY < y || mouseY > y2 : mouseX < x || mouseX > x2) return false
      const edge = bandEdgeAt(points, vertical ? mouseY : mouseX, orientation)
      if (edge === undefined) return false
      return vertical
        ? mouseX >= edge && mouseX <= edge + width
        : mouseY >= edge && mouseY <= edge + height
    },
    draw(ctx, progress) {
      if (progress < 1) {
        const ys = points.map((p) => p.y)
        const xs = points.map((p) => p.x)
        ctx.beginPath()
        if (vertical) {
          const left = Math.min(...xs)
          ctx.rect(left, y, Math.max(...xs) - left + thickness + 1, (y2 - y) * progress + 1)
        } else {
          const top = Math.min(...ys)
          ctx.rect(x, top, (x2 - x) * progress + 1, Math.max(...ys) - top + thickness + 1)
        }
        ctx.clip()
      }
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 0; i < last; i++) {
        const a = points[i]
        const b = points[i + 1]
        if (isCurve(i)) {
          const { cp1, cp2 } = controlPoints(a.x, a.y, b.x, b.y, orientation)
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y)
        } else {
          ctx.lineTo(b.x, b.y)
        }
      }
      ctx.lineTo(points[last].x + offset.x, points[last].y + offset.y)
      for (let i = last - 1; i >= 0; i--) {
        const a = points[i]
        const b = points[i + 1]
        if (isCurve(i)) {
          const { cp1, cp2 } = controlPoints(a.x, a.y, b.x, b.y, orientation)
          ctx.bezierCurveTo(
            cp2.x + offset.x,
            cp2.y + offset.y,
            cp1.x + offset.x,
            cp1.y + offset.y,
            a.x + offset.x,
            a.y + offset.y
          )
        } else {
          ctx.lineTo(a.x + offset.x, a.y + offset.y)
        }
      }
      ctx.lineTo(points[0].x, points[0].y)
      ctx.stroke()
      ctx.closePath()
      ctx.fill()
    },
    labelRect() {
      const [a, b] = longestCurve(points, orientation)
      return vertical
        ? { height: b.y - a.y, width: Math.abs(b.x - a.x) + width, x: Math.min(a.x, b.x), y: a.y }
        : { height: Math.abs(b.y - a.y) + height, width: b.x - a.x, x: a.x, y: Math.min(a.y, b.y) }
    },
  }
}

// -- back flows -------------------------------------------------------------

const fromUW = (p: UW, orientation: SankeyOrientation): FlowPoint =>
  orientation === 'vertical' ? { x: p.w, y: p.u } : { x: p.u, y: p.w }

/** Map the flow properties to the orientation independent shape (u along the columns, w across). */
function toBackFlowShape(props: ShapeProps): BackFlowShape {
  const { clear, height, lane, orientation, reach, reach2, width, x, x2, y, y2 } = props
  return orientation === 'vertical'
    ? {
        c1: x + width / 2,
        c2: x2 + width / 2,
        clear,
        lane,
        reach1: reach,
        reach2,
        t: width,
        u1: y,
        u2: y2,
      }
    : {
        c1: y + height / 2,
        c2: y2 + height / 2,
        clear,
        lane,
        reach1: reach,
        reach2,
        t: height,
        u1: x,
        u2: x2,
      }
}

export function laneShape(props: ShapeProps): FlowShape {
  const { orientation } = props
  const vertical = orientation === 'vertical'
  const shape = toBackFlowShape(props)

  return {
    box() {
      const { uMax, uMin, wMax, wMin } = backFlowBounds(shape)
      return vertical
        ? { xMax: wMax, xMin: wMin, yMax: uMax, yMin: uMin }
        : { xMax: uMax, xMin: uMin, yMax: wMax, yMin: wMin }
    },
    center() {
      // middle of the straight run along the lane, which is on the band
      const { points } = backFlowPath(shape)
      return fromUW({ u: (points[2].u + points[3].u) / 2, w: shape.lane }, orientation)
    },
    contains(mouseX, mouseY) {
      return isOnBackFlow(vertical ? { u: mouseY, w: mouseX } : { u: mouseX, w: mouseY }, shape)
    },
    // A constant thickness band is stroked, and revealed along its length with a dash.
    draw(ctx, progress) {
      const path = backFlowPath(shape)
      const [start, ...rest] = path.points.map((p) => fromUW(p, orientation))
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      for (let i = 0; i < rest.length - 1; i++) {
        ctx.arcTo(rest[i].x, rest[i].y, rest[i + 1].x, rest[i + 1].y, path.radius)
      }
      const end = rest.at(-1) as FlowPoint
      ctx.lineTo(end.x, end.y)
      ctx.lineWidth = shape.t
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'round'
      if (progress < 1) {
        const length = backFlowLength(path)
        ctx.setLineDash([length * progress, length + 1])
      }
      ctx.stroke()
    },
    labelRect() {
      const { points } = backFlowPath(shape)
      const u = Math.min(points[2].u, points[3].u)
      const length = Math.abs(points[2].u - points[3].u)
      const w = shape.lane - shape.t / 2
      return vertical
        ? { height: length, width: shape.t, x: w, y: u }
        : { height: shape.t, width: length, x: u, y: w }
    },
  }
}

export const shapeOf = (back: boolean, props: ShapeProps): FlowShape =>
  back ? laneShape(props) : bandShape(props)
