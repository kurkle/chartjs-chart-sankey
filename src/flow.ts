import type { Color } from 'chart.js'
import type { FlowConfig, FlowOptions, FlowProps, SankeyNode, SankeyOrientation } from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'

type FlowPoint = { x: number; y: number }
type ControlPoints = { cp1: FlowPoint; cp2: FlowPoint }

const controlPoints = (
  x: number,
  y: number,
  x2: number,
  y2: number,
  orientation: SankeyOrientation
): ControlPoints =>
  orientation === 'vertical'
    ? y < y2
      ? {
          cp1: { x, y: y + ((y2 - y) / 3) * 2 },
          cp2: { x: x2, y: y + (y2 - y) / 3 },
        }
      : {
          cp1: { x: 0, y: y - (y - y2) / 3 },
          cp2: { x: 0, y: y2 + (y - y2) / 3 },
        }
    : x < x2
      ? {
          cp1: { x: x + ((x2 - x) / 3) * 2, y },
          cp2: { x: x + (x2 - x) / 3, y: y2 },
        }
      : {
          cp1: { x: x - (x - x2) / 3, y: 0 },
          cp2: { x: x2 + (x - x2) / 3, y: 0 },
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

const applyAlpha = (original: string, alpha: number): string =>
  color(original).alpha(alpha).rgbString()
const getColorOption = (option: Color, alpha: number): Color =>
  typeof option === 'string' ? applyAlpha(option, alpha) : option
const getHoverColorOption = (option: Color): Color =>
  typeof option === 'string' ? getHoverColor(option) : option

function setStyle(ctx: CanvasRenderingContext2D, { x, x2, y, y2, options }: FlowConfig) {
  let fill: string | CanvasGradient | CanvasPattern = 'black'

  if (options.flowColor !== null) {
    fill = options.flowColor
  } else if (options.colorMode === 'from') {
    fill = getColorOption(options.colorFrom, options.alpha)
  } else if (options.colorMode === 'to') {
    fill = getColorOption(options.colorTo, options.alpha)
  } else if (typeof options.colorFrom === 'string' && typeof options.colorTo === 'string') {
    fill =
      options.orientation === 'vertical'
        ? ctx.createLinearGradient(0, y, 0, y2)
        : ctx.createLinearGradient(x, 0, x2, 0)
    fill.addColorStop(0, applyAlpha(options.colorFrom, options.alpha))
    fill.addColorStop(1, applyAlpha(options.colorTo, options.alpha))
  }

  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  ctx.lineWidth = 0.5
}

type FlowGeometry = Required<Pick<FlowConfig, 'height' | 'width' | 'x' | 'x2' | 'y' | 'y2'>>

function clipFlow(
  ctx: CanvasRenderingContext2D,
  { height, width, x, x2, y, y2 }: FlowGeometry,
  progress: number,
  orientation: SankeyOrientation
) {
  ctx.beginPath()
  if (orientation === 'vertical') {
    ctx.rect(Math.min(x, x2), y, Math.abs(x2 - x) + width + 1, (y2 - y) * progress + 1)
  } else {
    ctx.rect(x, Math.min(y, y2), (x2 - x) * progress + 1, Math.abs(y2 - y) + height + 1)
  }
  ctx.clip()
}

function drawFlowPath(
  ctx: CanvasRenderingContext2D,
  { height, width, x, x2, y, y2 }: FlowGeometry,
  { cp1, cp2 }: ControlPoints,
  orientation: SankeyOrientation
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2)
  if (orientation === 'vertical') {
    ctx.lineTo(x2 + width, y2)
    ctx.bezierCurveTo(cp2.x + width, cp2.y, cp1.x + width, cp1.y, x + width, y)
  } else {
    ctx.lineTo(x2, y2 + height)
    ctx.bezierCurveTo(cp2.x, cp2.y + height, cp1.x, cp1.y + height, x, y + height)
  }
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.closePath()
  ctx.fill()
}

/**
 * The range the top edge of a band stays in across the columns: between w and w2 for a forward
 * flow, whose w is monotone, and within the hull of its control points for a back flow, where
 * they are 0 (the true minimum is w * w2 / (sqrt(w) + sqrt(w2))^2, so 0 is a safe bound).
 */
function edgeRange(u: number, w: number, u2: number, w2: number): [number, number] {
  const floor = u > u2 ? 0 : w
  return [Math.min(w, w2, floor), Math.max(w, w2, floor)]
}

/** The top edge of a band across the columns where the mouse is at `mu` along them. */
function edgeAt(u: number, w: number, u2: number, w2: number, mu: number): number {
  if (u < u2) {
    const t = forwardParameter((mu - u) / (u2 - u))
    return w + (w2 - w) * (3 * t * t - 2 * t * t * t)
  }
  // the control points are evenly spaced, so u is linear in t, and w are 0
  const t = (mu - u) / (u2 - u)
  return w * (1 - t) ** 3 + w2 * t ** 3
}

function getLabelRect(
  { height, width, x, x2, y, y2 }: FlowGeometry,
  orientation: SankeyOrientation
) {
  if (orientation === 'vertical') {
    return {
      height: y2 - y,
      width: Math.abs(x2 - x) + width,
      x: Math.min(x, x2),
      y,
    }
  }
  return {
    height: Math.abs(y2 - y) + height,
    width: x2 - x,
    x,
    y: Math.min(y, y2),
  }
}

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
  from?: SankeyNode
  to?: SankeyNode

  constructor(cfg: FlowConfig) {
    super()

    if (cfg) {
      Object.assign(this, cfg)
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx: CanvasRenderingContext2D) {
    const { x, x2, y, y2, height, progress, width } = this
    const orientation = this.options.orientation
    const controls = controlPoints(x, y, x2, y2, orientation)
    const geometry = { height, width, x, x2, y, y2 }

    if (progress === 0) {
      return
    }
    ctx.save()
    if (progress < 1) {
      clipFlow(ctx, geometry, progress, orientation)
    }

    setStyle(ctx, this)
    drawFlowPath(ctx, geometry, controls, orientation)

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const labelRect = getLabelRect(geometry, orientation)
      drawLabel(ctx, `${this.flow}`, {
        autoPosition: 'center',
        backgroundColor: labels.backgroundColor,
        borderRadius: labels.borderRadius,
        borderWidth: 0,
        color: labels.color,
        font,
        height: labelRect.height,
        lineOffset: font.lineHeight / 2,
        padding: labels.padding,
        position: labels.position,
        width: labelRect.width,
        x: labelRect.x,
        y: labelRect.y,
      })
    }

    ctx.restore()
  }

  /**
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inRange(mouseX: number, mouseY: number, useFinalPosition: boolean): boolean {
    const { x, y, x2, y2, height, width } = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height', 'width'],
      useFinalPosition
    )
    // u runs along the columns and w across them
    const vertical = this.options.orientation === 'vertical'
    const [u, w, u2, w2, thickness] = vertical ? [y, x, y2, x2, width] : [x, y, x2, y2, height]
    const [mu, mw] = vertical ? [mouseY, mouseX] : [mouseX, mouseY]
    if (mu < Math.min(u, u2) || mu > Math.max(u, u2)) return false

    const [lowest, highest] = edgeRange(u, w, u2, w2)
    if (mw < lowest || mw > highest + thickness) return false
    // the top edge of the band at the mouse, the band runs `thickness` further across
    if (u === u2) return true
    const edge = edgeAt(u, w, u2, w2, mu)
    return mw >= edge && mw <= edge + thickness
  }

  /**
   * @param {number} mouseX
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const { x, x2, width } = this.getProps(['x', 'x2', 'width'], useFinalPosition)
    const min = Math.min(x, x2)
    const max = Math.max(x, x2) + (this.options.orientation === 'vertical' ? width : 0)
    return mouseX >= min && mouseX <= max
  }

  /**
   * @param {number} mouseY
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const { y, y2, height } = this.getProps(['y', 'y2', 'height'], useFinalPosition)
    const minY = Math.min(y, y2)
    const maxY = Math.max(y, y2) + (this.options.orientation === 'vertical' ? 0 : height)
    return mouseY >= minY && mouseY <= maxY
  }

  /**
   * @param {boolean} useFinalPosition
   * @return {{x: number, y:number}}
   */
  getCenterPoint(useFinalPosition: boolean): { x: number; y: number } {
    const { x, y, x2, y2, height, width } = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height', 'width'],
      useFinalPosition
    )
    const vertical = this.options.orientation === 'vertical'
    return {
      x: (x + x2 + (vertical ? width : 0)) / 2,
      y: (y + y2 + (vertical ? 0 : height)) / 2,
    }
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
