import type { Color } from 'chart.js'
import type { FlowConfig, FlowOptions, FlowProps, SankeyNode } from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'

type FlowPoint = { x: number; y: number }
type ControlPoints = { cp1: FlowPoint; cp2: FlowPoint }

const controlPoints = (x: number, y: number, x2: number, y2: number): ControlPoints =>
  x < x2
    ? {
        cp1: { x: x + ((x2 - x) / 3) * 2, y },
        cp2: { x: x + (x2 - x) / 3, y: y2 },
      }
    : {
        cp1: { x: x - (x - x2) / 3, y: 0 },
        cp2: { x: x2 + (x - x2) / 3, y: 0 },
      }

const pointInLine = (p1: FlowPoint, p2: FlowPoint, t: number): FlowPoint => ({
  x: p1.x + t * (p2.x - p1.x),
  y: p1.y + t * (p2.y - p1.y),
})

const applyAlpha = (original: string, alpha: number): string =>
  color(original).alpha(alpha).rgbString()
const getColorOption = (option: Color, alpha: number): Color =>
  typeof option === 'string' ? applyAlpha(option, alpha) : option
const getHoverColorOption = (option: Color): Color =>
  typeof option === 'string' ? getHoverColor(option) : option

function setStyle(ctx: CanvasRenderingContext2D, { x, x2, options }: FlowConfig) {
  let fill: string | CanvasGradient | CanvasPattern = 'black'

  if (options.linkColor !== null) {
    fill = options.linkColor
  } else if (options.colorMode === 'from') {
    fill = getColorOption(options.colorFrom, options.alpha)
  } else if (options.colorMode === 'to') {
    fill = getColorOption(options.colorTo, options.alpha)
  } else if (typeof options.colorFrom === 'string' && typeof options.colorTo === 'string') {
    fill = ctx.createLinearGradient(x, 0, x2, 0)
    fill.addColorStop(0, applyAlpha(options.colorFrom, options.alpha))
    fill.addColorStop(1, applyAlpha(options.colorTo, options.alpha))
  }

  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  ctx.lineWidth = 0.5
}

export default class Flow extends Element<FlowProps, FlowOptions> {
  static readonly id = 'flow'
  static override readonly defaults = {
    alpha: 0.5,
    colorFrom: 'red',
    colorMode: 'gradient',
    colorTo: 'green',
    flowLabels: {
      borderRadius: 0,
      color: 'black',
      display: false,
      padding: 4,
      position: 'center',
    },
    hoverColorFrom: (_ctx: unknown, options: FlowOptions) => getHoverColorOption(options.colorFrom),
    hoverColorTo: (_ctx: unknown, options: FlowOptions) => getHoverColorOption(options.colorTo),
    linkColor: null,
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
    const { x, x2, y, y2, height, progress } = this
    const { cp1, cp2 } = controlPoints(x, y, x2, y2)

    if (progress === 0) {
      return
    }
    ctx.save()
    if (progress < 1) {
      ctx.beginPath()
      ctx.rect(x, Math.min(y, y2), (x2 - x) * progress + 1, Math.abs(y2 - y) + height + 1)
      ctx.clip()
    }

    setStyle(ctx, this)

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2)
    ctx.lineTo(x2, y2 + height)
    ctx.bezierCurveTo(cp2.x, cp2.y + height, cp1.x, cp1.y + height, x, y + height)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.closePath()

    ctx.fill()

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const top = Math.min(y, y2)
      drawLabel(ctx, `${this.flow}`, {
        autoPosition: 'center',
        backgroundColor: labels.backgroundColor,
        borderRadius: labels.borderRadius,
        borderWidth: 0,
        color: labels.color,
        font,
        height: Math.abs(y2 - y) + height,
        lineOffset: font.lineHeight / 2,
        padding: labels.padding,
        position: labels.position,
        width: x2 - x,
        x,
        y: top,
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
    const { x, y, x2, y2, height } = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height'],
      useFinalPosition
    )
    if (mouseX < x || mouseX > x2) {
      return false
    }
    const { cp1, cp2 } = controlPoints(x, y, x2, y2)
    const t = (mouseX - x) / (x2 - x)
    const p1 = { x, y }
    const p2 = { x: x2, y: y2 }
    const a = pointInLine(p1, cp1, t)
    const b = pointInLine(cp1, cp2, t)
    const c = pointInLine(cp2, p2, t)
    const d = pointInLine(a, b, t)
    const e = pointInLine(b, c, t)
    const topY = pointInLine(d, e, t).y
    return mouseY >= topY && mouseY <= topY + height
  }

  /**
   * @param {number} mouseX
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const { x, x2 } = this.getProps(['x', 'x2'], useFinalPosition)
    return mouseX >= x && mouseX <= x2
  }

  /**
   * @param {number} mouseY
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const { y, y2, height } = this.getProps(['y', 'y2', 'height'], useFinalPosition)
    const minY = Math.min(y, y2)
    const maxY = Math.max(y, y2) + height
    return mouseY >= minY && mouseY <= maxY
  }

  /**
   * @param {boolean} useFinalPosition
   * @return {{x: number, y:number}}
   */
  getCenterPoint(useFinalPosition: boolean): { x: number; y: number } {
    const { x, y, x2, y2, height } = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height'],
      useFinalPosition
    )
    return {
      x: (x + x2) / 2,
      y: (y + y2 + height) / 2,
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
    return axis === 'x' ? this.width / 2 : this.height / 2
  }
}
