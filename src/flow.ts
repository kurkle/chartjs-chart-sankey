import type { Color } from 'chart.js'
import type { FlowShape } from './lib/flow-shapes.js'
import type { FlowConfig, FlowOptions, FlowProps, Route, SankeyNode } from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'
import { shapeOf } from './lib/flow-shapes.js'
import { FRAMES } from './lib/route.js'

const applyAlpha = (original: string, alpha: number): string =>
  color(original).alpha(alpha).rgbString()
const getColorOption = (option: Color, alpha: number): Color =>
  typeof option === 'string' ? applyAlpha(option, alpha) : option
const getHoverColorOption = (option: Color): Color =>
  typeof option === 'string' ? getHoverColor(option) : option

function setStyle(ctx: CanvasRenderingContext2D, { options }: FlowConfig, u1: number, u2: number) {
  let fill: string | CanvasGradient | CanvasPattern = 'black'

  if (options.flowColor !== null) {
    fill = options.flowColor
  } else if (options.colorMode === 'from') {
    fill = getColorOption(options.colorFrom, options.alpha)
  } else if (options.colorMode === 'to') {
    fill = getColorOption(options.colorTo, options.alpha)
  } else if (typeof options.colorFrom === 'string' && typeof options.colorTo === 'string') {
    fill = FRAMES[options.orientation].gradient(ctx, u1, u2)
    fill.addColorStop(0, applyAlpha(options.colorFrom, options.alpha))
    fill.addColorStop(1, applyAlpha(options.colorTo, options.alpha))
  }

  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  ctx.lineWidth = 0.5
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
  /** true when the flow does not go to a later column and is routed through its loop slots */
  back = false
  /**
   * The finished route of the flow in (u, w), see route.ts. Without one (an
   * element made by hand) the route is a plain band from `x, y` to `x2, y2`.
   */
  route?: Route
  from?: SankeyNode
  to?: SankeyNode

  // The shape worked out from the route, kept until the route is replaced.
  private _shape?: {
    /** the canvas rectangle that holds the band, for a quick rejection */
    bounds: { height: number; width: number; x: number; y: number }
    orientation: string
    route: Route
    shape: FlowShape
  }

  constructor(cfg: FlowConfig) {
    super()

    if (cfg) {
      Object.assign(this, cfg)
    }
  }

  private routeOf(useFinalPosition: boolean): Route {
    const { route } = this.getProps(ROUTE_PROPS, useFinalPosition)
    if (route) return route
    const { x, x2, y, y2, height, width } = this.getProps(BOX_PROPS, useFinalPosition)
    const frame = FRAMES[this.options.orientation]
    return {
      kind: 'band',
      points: [frame.uw(x, y), frame.uw(x2, y2)],
      t: this.options.orientation === 'vertical' ? width : height,
    }
  }

  /** The shape of the flow and its bounds, kept until the route is replaced. */
  private cached(useFinalPosition: boolean) {
    const route = this.routeOf(useFinalPosition)
    const { orientation } = this.options
    if (this._shape?.route !== route || this._shape.orientation !== orientation) {
      const frame = FRAMES[orientation]
      const shape = shapeOf(route, frame)
      const { u, w, du, dw } = shape.box()
      this._shape = { bounds: frame.rect(u, w, du, dw), orientation, route, shape }
    }
    return this._shape
  }

  private shape(useFinalPosition = false): FlowShape {
    return this.cached(useFinalPosition).shape
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx: CanvasRenderingContext2D) {
    if (this.progress === 0) {
      return
    }
    const route = this.routeOf(false)
    const shape = this.shape()
    ctx.save()
    const ends = [route.points[0]?.u ?? 0, route.points.at(-1)?.u ?? 0]
    // a back flow's gradient runs from its source to its target, which are at its two ends
    setStyle(ctx, this, ends[0], ends[1])
    shape.draw(ctx, this.progress)

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const { u, w, du, dw } = shape.labelRect()
      const rect = FRAMES[this.options.orientation].rect(u, w, du, dw)
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

  inRange(mouseX: number, mouseY: number, useFinalPosition: boolean): boolean {
    const { bounds, shape } = this.cached(useFinalPosition)
    if (
      mouseX < bounds.x ||
      mouseX > bounds.x + bounds.width ||
      mouseY < bounds.y ||
      mouseY > bounds.y + bounds.height
    ) {
      return false
    }
    return shape.contains(FRAMES[this.options.orientation].uw(mouseX, mouseY))
  }

  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const { x, width } = this.cached(useFinalPosition).bounds
    return mouseX >= x && mouseX <= x + width
  }

  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const { y, height } = this.cached(useFinalPosition).bounds
    return mouseY >= y && mouseY <= y + height
  }

  getCenterPoint(useFinalPosition: boolean): { x: number; y: number } {
    const { u, w } = this.shape(useFinalPosition).center()
    return FRAMES[this.options.orientation].point(u, w)
  }

  override tooltipPosition(useFinalPosition = false) {
    return this.getCenterPoint(useFinalPosition)
  }

  /**
   * @param {"x" | "y"} axis
   * @return {number}
   */
  getRange(axis: 'x' | 'y'): number {
    const vertical = this.options.orientation === 'vertical'
    if (axis === 'x') return vertical ? this.width / 2 : 0
    return vertical ? 0 : this.height / 2
  }
}
