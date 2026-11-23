import type { Color } from 'chart.js'
import type {
  FlowConfig,
  FlowOptions,
  FlowProps,
  Route,
  SankeyNode,
  SankeyOrientation,
  UW,
} from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'

const applyAlpha = (original: string, alpha: number): string =>
  color(original).alpha(alpha).rgbString()
const getColorOption = (option: Color, alpha: number): Color =>
  typeof option === 'string' ? applyAlpha(option, alpha) : option
const getHoverColorOption = (option: Color): Color =>
  typeof option === 'string' ? getHoverColor(option) : option

function setStyle(ctx: CanvasRenderingContext2D, options: FlowOptions, from: XY, to: XY) {
  let fill: string | CanvasGradient | CanvasPattern = 'black'

  if (options.flowColor !== null) {
    fill = options.flowColor
  } else if (options.colorMode === 'from') {
    fill = getColorOption(options.colorFrom, options.alpha)
  } else if (options.colorMode === 'to') {
    fill = getColorOption(options.colorTo, options.alpha)
  } else if (typeof options.colorFrom === 'string' && typeof options.colorTo === 'string') {
    fill = ctx.createLinearGradient(...from, ...to)
    fill.addColorStop(0, applyAlpha(options.colorFrom, options.alpha))
    fill.addColorStop(1, applyAlpha(options.colorTo, options.alpha))
  }

  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  ctx.lineWidth = 0.5
}

// Everything below works in (u, w): `u` runs along the columns and `w` across
// them. Only the frame knows which way the chart runs: it maps (u, w) to the
// canvas, and the canvas back to (u, w).
type XY = [x: number, y: number]
type Frame = (u: number, w: number) => XY
const FRAMES: Record<SankeyOrientation, Frame> = {
  horizontal: (u, w) => [u, w],
  vertical: (u, w) => [w, u],
}

/** The outline of a forward band, or the center line of a back flow. */
function trace(ctx: CanvasRenderingContext2D, { points, radius, radius2, t }: Route, at: Frame) {
  const last = points.length - 1
  // The edge of a band, `dw` across from the points: a curve between two columns
  // (the same one in both directions), then a straight run across a skipped one.
  const edgeTo = (a: UW, b: UW, dw: number, curve: boolean) => {
    const third = (b.u - a.u) / 3
    const end = at(b.u, b.w + dw)
    if (curve) {
      ctx.bezierCurveTo(...at(a.u + 2 * third, a.w + dw), ...at(a.u + third, b.w + dw), ...end)
    } else {
      ctx.lineTo(...end)
    }
  }
  ctx.beginPath()
  ctx.moveTo(...at(points[0].u, points[0].w))
  if (radius === undefined) {
    for (let i = 0; i < last; i++) edgeTo(points[i], points[i + 1], 0, i % 2 === 0)
    ctx.lineTo(...at(points[last].u, points[last].w + t))
    for (let i = last; i > 0; i--) edgeTo(points[i], points[i - 1], t, i % 2 === 1)
    ctx.lineTo(...at(points[0].u, points[0].w))
  } else {
    for (let i = 1; i < last; i++) {
      // the turns at the target are the last two
      const r = i > 2 ? (radius2 ?? radius) : radius
      ctx.arcTo(...at(points[i].u, points[i].w), ...at(points[i + 1].u, points[i + 1].w), r)
    }
    ctx.lineTo(...at(points[last].u, points[last].w))
  }
}

/**
 * The curve parameter at which a forward flow has run the share `s` of its way along the
 * columns. The control points sit at 2/3 and 1/3, so that share is 2t - 3t^2 + 2t^3, whose
 * slope 2 - 6t + 6t^2 is at least 0.5: it is monotone and Newton's method finds the root.
 * The step is below 1e-7 when it stops, which moves the band by far less than 0.01 px.
 */
function forwardParameter(s: number): number {
  let t = s
  for (let i = 0; i < 12; i++) {
    const step = (2 * t - 3 * t * t + 2 * t * t * t - s) / (2 - 6 * t + 6 * t * t)
    t = Math.min(1, Math.max(0, t - step))
    if (Math.abs(step) < 1e-7) break
  }
  return t
}

/** Least thickness of the area that hits a flow, in CSS pixels: a thinner flow is hit within this much of its center. */
export const MIN_HIT = 3

/** How far from a flow of thickness t the mouse still hits it. */
const reachOf = (t: number) => Math.max(0, (MIN_HIT - t) / 2)

/** The top edge of a forward band where the mouse is at `mu` along the columns, and its slope across the columns. */
function edgeAt(points: UW[], mu: number): [edge: number, slope: number] {
  let i = 0
  while (i < points.length - 2 && mu > points[i + 1].u) i++
  const [a, b] = [points[i], points[i + 1]]
  if (b.u === a.u) return [a.w, 0]
  const share = (mu - a.u) / (b.u - a.u)
  // the segments alternate between a curve and a straight run across a skipped column
  if (i % 2 !== 0) return [a.w + (b.w - a.w) * share, (b.w - a.w) / (b.u - a.u)]
  const t = forwardParameter(share)
  const slope = ((b.w - a.w) * (6 * t - 6 * t * t)) / ((b.u - a.u) * (2 - 6 * t + 6 * t * t))
  return [a.w + (b.w - a.w) * (3 * t * t - 2 * t * t * t), slope]
}

/** The distance from (mu, mw) to a forward band, 0 on it: across the band, reduced by the slope of its edge. */
function bandDistance({ points, t }: Route, mu: number, mw: number) {
  const [first, last] = [points[0].u, (points.at(-1) as UW).u]
  const along = Math.max(first - mu, mu - last, 0)
  const [edge, slope] = edgeAt(points, Math.min(last, Math.max(first, mu)))
  const across = Math.max(edge - mw, mw - (edge + t), 0) / Math.sqrt(1 + slope * slope)
  return along === 0 ? across : Math.hypot(along, across)
}

/** The length of the run of a lane from point i to the next, and its unit direction. */
function runOf({ points }: Route, i: number) {
  const [du, dw] = [points[i + 1].u - points[i].u, points[i + 1].w - points[i].w]
  const length = Math.hypot(du, dw)
  return { du: du / (length || 1), dw: dw / (length || 1), length }
}

/** How far the corner at point i cuts into the runs on both sides of it: the radius of its arc. */
function cutOf({ points, radius = 0, radius2 }: Route, i: number) {
  if (i <= 0 || i >= points.length - 1) return 0
  // the turns at the target are the last two
  return i > 2 ? (radius2 ?? radius) : radius
}

/** The distance from the point to the stroke of the straight run from point i, without what the corners cut off. */
function runDistance(route: Route, i: number, mu: number, mw: number) {
  const { du, dw, length } = runOf(route, i)
  if (length === 0) return Number.POSITIVE_INFINITY
  const [pu, pw] = [mu - route.points[i].u, mw - route.points[i].w]
  const along = pu * du + pw * dw
  const past = Math.max(cutOf(route, i) - along, along - (length - cutOf(route, i + 1)), 0)
  return Math.hypot(past, Math.max(Math.abs(pu * dw - pw * du) - route.t / 2, 0))
}

/** The distance from the point to the arc of the corner at point i, or to the round join of a bare one. */
function cornerDistance(route: Route, i: number, mu: number, mw: number) {
  const [into, out] = [runOf(route, i - 1), runOf(route, i)]
  // a corner between two runs that are not at a right angle has no arc
  if (!into.length || !out.length || Math.abs(into.du * out.du + into.dw * out.dw) > 1e-6) {
    return Number.POSITIVE_INFINITY
  }
  const r = cutOf(route, i)
  const [pu, pw] = [mu - route.points[i].u, mw - route.points[i].w]
  const half = route.t / 2
  if (r === 0) return Math.max(Math.hypot(pu, pw) - half, 0)
  // back along the run that comes in, and on along the one that goes out
  const [au, aw, bu, bw] = [-into.du, -into.dw, out.du, out.dw]
  const [vu, vw] = [pu - (au + bu) * r, pw - (aw + bw) * r]
  // the quarter of the circle that faces the corner
  if (vu * au + vw * aw > 0 || vu * bu + vw * bw > 0) return Number.POSITIVE_INFINITY
  return Math.max(Math.abs(Math.hypot(vu, vw) - r) - half, 0)
}

/**
 * The distance from (mu, mw) to the stroke of a back flow, as `trace` draws it, 0 on it: the
 * center line is straight runs joined by arcs, and the stroke is `t` wide with butt ends. The
 * runs lie along the axes, so a corner of radius r cuts r off its two runs and is replaced by
 * a quarter circle around the point that is r in from both of them.
 */
function laneDistance(route: Route, mu: number, mw: number) {
  const last = route.points.length - 1
  let least = Number.POSITIVE_INFINITY
  for (let i = 0; i < last; i++) least = Math.min(least, runDistance(route, i, mu, mw))
  for (let i = 1; i < last; i++) least = Math.min(least, cornerDistance(route, i, mu, mw))
  return least
}

/** The rectangle that holds the band. */
function bounds({ points, radius, t }: Route) {
  let [u0, u1, w0, w1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const { u, w } of points) {
    u0 = Math.min(u0, u)
    u1 = Math.max(u1, u)
    w0 = Math.min(w0, w)
    w1 = Math.max(w1, w)
  }
  const pad = radius === undefined ? 0 : t / 2
  return { du: u1 + pad - (u0 - pad), dw: w1 - pad + t - (w0 - pad), u: u0 - pad, w: w0 - pad }
}

/** The part the label and the tooltip sit on: the lane of a back flow, the longest curve of a band. */
function mainRun({ points, radius }: Route): [UW, UW] {
  let best = radius === undefined ? 0 : 2
  for (let i = 2; radius === undefined && i < points.length - 1; i += 2) {
    if (points[i + 1].u - points[i].u > points[best + 1].u - points[best].u) best = i
  }
  return [points[best], points[best + 1]]
}

/** Length of the center line of a back flow: every turn cuts a corner. */
const lengthOf = ({ points, radius = 0 }: Route) =>
  points.reduce(
    (sum, p, i) => {
      const prev = points[i - 1] ?? p
      return sum + Math.abs(p.u - prev.u) + Math.abs(p.w - prev.w)
    },
    (points.length - 2) * (Math.PI / 2 - 2) * radius
  )

const mix = (a: number, b: number, factor: number) => a + (b - a) * factor

/**
 * The forward route `short` with as many waypoint pairs (an entry and the next exit) as
 * `long`. A pair of `short` is kept where `long` has a pair at the same place along the
 * columns, within a pixel, or where as many pairs are left in both; else a pair of zero
 * length is put on the point before it (the first point when there is none). A pair of zero
 * length draws nothing, so the padded route is drawn and hit as `short`.
 */
function padRoute(short: Route, long: Route): Route {
  const pairs = (short.points.length - 2) / 2
  const longPairs = (long.points.length - 2) / 2
  const points = [short.points[0]]
  let i = 0
  for (let j = 0; j < longPairs; j++) {
    const at = Math.abs(short.points[2 * i + 1].u - long.points[2 * j + 1].u) <= 1
    if (i < pairs && (at || pairs - i === longPairs - j)) {
      points.push(short.points[2 * i + 1], short.points[2 * i + 2])
      i++
    } else {
      points.push(short.points[2 * i], short.points[2 * i])
    }
  }
  points.push(short.points.at(-1) as UW)
  return { ...short, points }
}

/** Whether two routes have shapes in between: not a forward and a back one, nor other turns. */
const mixable = (a: Route, b: Route) =>
  a.radius === undefined
    ? b.radius === undefined
    : b.radius !== undefined && a.points.length === b.points.length

/**
 * Interpolates two routes for the animations. Forward routes of different length are mixed
 * after the shorter one is padded; routes that cannot be mixed switch in the middle.
 */
export function interpolateRoute(
  from: Route | undefined,
  to: Route | undefined,
  factor: number
): Route | undefined {
  if (!from) return to
  if (!to || !mixable(from, to)) return factor > 0.5 ? to : from
  const a = from.points.length < to.points.length ? padRoute(from, to) : from
  const b = to.points.length < from.points.length ? padRoute(to, from) : to
  return {
    points: b.points.map((p, i) => ({
      u: mix(a.points[i].u, p.u, factor),
      w: mix(a.points[i].w, p.w, factor),
    })),
    radius: b.radius === undefined ? undefined : mix(a.radius as number, b.radius, factor),
    radius2:
      b.radius2 === undefined
        ? undefined
        : mix(a.radius2 ?? (a.radius as number), b.radius2, factor),
    t: mix(a.t, b.t, factor),
  }
}

const ROUTE_PROPS: Array<'route'> = ['route']
const BOX_PROPS: Array<'x' | 'x2' | 'y' | 'y2' | 'height' | 'width'> = [
  'x',
  'x2',
  'y',
  'y2',
  'height',
  'width',
]

export default class Flow extends Element<FlowProps, FlowOptions> {
  static readonly id = 'flow'
  static override readonly defaults = {
    alpha: 0.5,
    colorFrom: 'red',
    colorMode: 'gradient',
    colorTo: 'green',
    flowColor: null,
    flowLabels: {
      borderRadius: 0,
      color: 'black',
      display: false,
      padding: 4,
      position: 'center',
    },
    hoverColorFrom: (_ctx: unknown, options: FlowOptions) => getHoverColorOption(options.colorFrom),
    hoverColorTo: (_ctx: unknown, options: FlowOptions) => getHoverColorOption(options.colorTo),
    orientation: 'horizontal',
  }

  static readonly descriptors = {
    _scriptable: true,
    flowLabels: {
      _scriptable: true,
    },
  }

  flow = 0
  x2 = 0
  y2 = 0
  width = 0
  height = 0
  progress = 1
  /** true when the flow does not go to a later column and is routed along a lane */
  back = false
  /**
   * The finished route of the flow in (u, w), see route.ts. Without one (an
   * element made by hand) the route is a plain band from `x, y` to `x2, y2`.
   */
  route?: Route
  from?: SankeyNode
  to?: SankeyNode

  constructor(cfg: FlowConfig) {
    super()

    if (cfg) {
      Object.assign(this, cfg)
    }
  }

  private get frame() {
    return FRAMES[this.options.orientation]
  }

  private routeOf(useFinalPosition: boolean): Route {
    const { route } = this.getProps(ROUTE_PROPS, useFinalPosition)
    if (route) return route
    const { x, x2, y, y2, height, width } = this.getProps(BOX_PROPS, useFinalPosition)
    const [first, last, size] = [this.frame(x, y), this.frame(x2, y2), this.frame(width, height)]
    return {
      points: [
        { u: first[0], w: first[1] },
        { u: last[0], w: last[1] },
      ],
      t: size[1],
    }
  }

  /** A rectangle of (u, w) on the canvas. */
  private rect({ u, w, du, dw }: { u: number; w: number; du: number; dw: number }) {
    const [x, y] = this.frame(u, w)
    const [width, height] = this.frame(du, dw)
    return { height, width, x, y }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { frame, progress } = this
    if (progress === 0) {
      return
    }
    const route = this.routeOf(false)
    const { points, t } = route
    ctx.save()
    setStyle(ctx, this.options, frame(points[0].u, 0), frame((points.at(-1) as UW).u, 0))
    if (route.radius === undefined) {
      // a band is filled, and revealed along the columns
      if (progress < 1) {
        const { u, w, du, dw } = bounds(route)
        const clip = this.rect({ du: du * progress + 1, dw: dw + 1, u, w })
        ctx.beginPath()
        ctx.rect(clip.x, clip.y, clip.width, clip.height)
        ctx.clip()
      }
      trace(ctx, route, frame)
      ctx.stroke()
      ctx.closePath()
      ctx.fill()
    } else {
      // a back flow is a stroke of constant thickness, revealed along its length with a dash
      trace(ctx, route, frame)
      ctx.lineWidth = t
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'round'
      if (progress < 1) {
        const length = lengthOf(route)
        ctx.setLineDash([length * progress, length + 1])
      }
      ctx.stroke()
    }

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const [a, b] = mainRun(route)
      const rect = this.rect({
        du: Math.abs(b.u - a.u),
        dw: Math.abs(b.w - a.w) + t,
        u: Math.min(a.u, b.u),
        w: Math.min(a.w, b.w) - (route.radius === undefined ? 0 : t / 2),
      })
      drawLabel(ctx, `${this.flow}`, {
        autoPosition: 'center',
        backgroundColor: labels.backgroundColor,
        borderRadius: labels.borderRadius,
        borderWidth: 0,
        color: labels.color,
        font,
        height: rect.height,
        lineOffset: font.lineHeight / 2,
        padding: labels.padding,
        position: labels.position,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      })
    }

    ctx.restore()
  }

  /**
   * The distance from the point to the band or to the stroke of the back flow, worked out from
   * the route: 0 on it. It is measured within the reach of a thin flow (see `MIN_HIT`) and is
   * Infinity farther away, where nothing needs to know it.
   */
  distance(mouseX: number, mouseY: number, useFinalPosition: boolean): number {
    const route = this.routeOf(useFinalPosition)
    const [mu, mw] = this.options.orientation === 'vertical' ? [mouseY, mouseX] : [mouseX, mouseY]
    const reach = reachOf(route.t)
    const { du, dw, u, w } = bounds(route)
    if (mu < u - reach || mu > u + du + reach || mw < w - reach || mw > w + dw + reach) {
      return Number.POSITIVE_INFINITY
    }
    return route.radius === undefined ? bandDistance(route, mu, mw) : laneDistance(route, mu, mw)
  }

  /**
   * A flow is hit on its band, and within a pixel and a half of its center line when it is
   * thinner than `MIN_HIT`, so that a thin flow can be pointed at.
   */
  inRange(mouseX: number, mouseY: number, useFinalPosition: boolean): boolean {
    return (
      this.distance(mouseX, mouseY, useFinalPosition) <= reachOf(this.routeOf(useFinalPosition).t)
    )
  }

  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const route = this.routeOf(useFinalPosition)
    const { x, width } = this.rect(bounds(route))
    const reach = this.options.orientation === 'vertical' ? reachOf(route.t) : 0
    return mouseX >= x - reach && mouseX <= x + width + reach
  }

  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const route = this.routeOf(useFinalPosition)
    const { y, height } = this.rect(bounds(route))
    const reach = this.options.orientation === 'vertical' ? 0 : reachOf(route.t)
    return mouseY >= y - reach && mouseY <= y + height + reach
  }

  getCenterPoint(useFinalPosition: boolean): { x: number; y: number } {
    const route = this.routeOf(useFinalPosition)
    const [a, b] = mainRun(route)
    const across = route.radius === undefined ? route.t / 2 : 0
    const [x, y] = this.frame((a.u + b.u) / 2, (a.w + b.w) / 2 + across)
    return { x, y }
  }

  override tooltipPosition(useFinalPosition = false) {
    return this.getCenterPoint(useFinalPosition)
  }

  getRange(axis: 'x' | 'y'): number {
    const vertical = this.options.orientation === 'vertical'
    if (axis === 'x') return vertical ? this.width / 2 : 0
    return vertical ? 0 : this.height / 2
  }
}
