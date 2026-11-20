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
function trace(ctx: CanvasRenderingContext2D, { points, radius, t }: Route, at: Frame) {
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
      ctx.arcTo(...at(points[i].u, points[i].w), ...at(points[i + 1].u, points[i + 1].w), radius)
    }
    ctx.lineTo(...at(points[last].u, points[last].w))
  }
}

/** The rectangle that holds the band. */
function bounds({ points, radius, t }: Route) {
  const us = points.map((p) => p.u)
  const ws = points.map((p) => p.w)
  const pad = radius === undefined ? 0 : t / 2
  const u = Math.min(...us) - pad
  const w = Math.min(...ws) - pad
  return { du: Math.max(...us) + pad - u, dw: Math.max(...ws) - pad + t - w, u, w }
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

/** Interpolates two routes for the animations; routes of different shapes switch in the middle. */
export function interpolateRoute(
  from: Route | undefined,
  to: Route | undefined,
  factor: number
): Route | undefined {
  if (!from) return to
  if (!to || from.points.length !== to.points.length || typeof from.radius !== typeof to.radius) {
    return factor > 0.5 ? to : from
  }
  return {
    points: to.points.map((p, i) => ({
      u: mix(from.points[i].u, p.u, factor),
      w: mix(from.points[i].w, p.w, factor),
    })),
    radius: to.radius === undefined ? undefined : mix(from.radius as number, to.radius, factor),
    t: mix(from.t, to.t, factor),
  }
}

// A context nothing is drawn on, for asking the canvas whether a point is on a path.
let probe: CanvasRenderingContext2D | undefined

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

  /** The canvas says whether the point is on the band: it is asked about the path that is drawn. */
  inRange(mouseX: number, mouseY: number, useFinalPosition: boolean): boolean {
    if (!this.inXRange(mouseX, useFinalPosition) || !this.inYRange(mouseY, useFinalPosition)) {
      return false
    }
    const route = this.routeOf(useFinalPosition)
    probe ??= document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
    trace(probe, route, FRAMES.horizontal)
    probe.lineWidth = route.t
    return route.radius === undefined
      ? probe.isPointInPath(...this.frame(mouseX, mouseY))
      : probe.isPointInStroke(...this.frame(mouseX, mouseY))
  }

  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const { x, width } = this.rect(bounds(this.routeOf(useFinalPosition)))
    return mouseX >= x && mouseX <= x + width
  }

  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const { y, height } = this.rect(bounds(this.routeOf(useFinalPosition)))
    return mouseY >= y && mouseY <= y + height
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
