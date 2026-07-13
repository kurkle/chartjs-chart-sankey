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

function setStyle(ctx: CanvasRenderingContext2D, { x, x2, y, y2, options }: FlowConfig) {
  let fill: string | CanvasGradient | CanvasPattern = 'black'

  if (options.linkColor !== null) {
    fill = options.linkColor
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
    const vertical = this.options.orientation === 'vertical'
    if (vertical ? mouseY < y || mouseY > y2 : mouseX < x || mouseX > x2) return false

    const { cp1, cp2 } = controlPoints(x, y, x2, y2, this.options.orientation)
    const t = vertical ? (mouseY - y) / (y2 - y) : (mouseX - x) / (x2 - x)
    const p1 = { x, y }
    const p2 = { x: x2, y: y2 }
    const a = pointInLine(p1, cp1, t)
    const b = pointInLine(cp1, cp2, t)
    const c = pointInLine(cp2, p2, t)
    const d = pointInLine(a, b, t)
    const e = pointInLine(b, c, t)
    const edge = pointInLine(d, e, t)
    return vertical
      ? mouseX >= edge.x && mouseX <= edge.x + width
      : mouseY >= edge.y && mouseY <= edge.y + height
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
