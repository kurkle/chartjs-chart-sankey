import type { Color } from 'chart.js'
import type { BackFlowShape, UW } from './lib/back-flows.js'
import type { FlowConfig, FlowOptions, FlowProps, SankeyNode, SankeyOrientation } from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'
import {
  backFlowBounds,
  backFlowClearance,
  backFlowLength,
  backFlowPath,
  isOnBackFlow,
} from './lib/back-flows.js'

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

type BackFlowProps = Pick<
  FlowProps,
  'height' | 'lane' | 'reach' | 'width' | 'x' | 'x2' | 'y' | 'y2'
>

/** Map the flow properties to the orientation independent shape (u along the columns, w across). */
function toBackFlowShape(
  { height, lane, reach, width, x, x2, y, y2 }: BackFlowProps,
  clear: number,
  orientation: SankeyOrientation
): BackFlowShape {
  return orientation === 'vertical'
    ? { c1: x + width / 2, c2: x2 + width / 2, clear, lane, reach, t: width, u1: y, u2: y2 }
    : { c1: y + height / 2, c2: y2 + height / 2, clear, lane, reach, t: height, u1: x, u2: x2 }
}

const fromUW = (p: UW, orientation: SankeyOrientation) =>
  orientation === 'vertical' ? { x: p.w, y: p.u } : { x: p.u, y: p.w }

/**
 * Back flows are a constant thickness band along a center line, so they are
 * stroked instead of filled. The progress animation reveals the band along
 * its length (source to target) with a dash pattern.
 */
function drawBackFlow(
  ctx: CanvasRenderingContext2D,
  shape: BackFlowShape,
  progress: number,
  orientation: SankeyOrientation
) {
  const path = backFlowPath(shape)
  const [start, ...rest] = path.points.map((p) => fromUW(p, orientation))
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  for (let i = 0; i < rest.length - 1; i++) {
    ctx.arcTo(rest[i].x, rest[i].y, rest[i + 1].x, rest[i + 1].y, path.radius)
  }
  const last = rest.at(-1) as FlowPoint
  ctx.lineTo(last.x, last.y)
  ctx.lineWidth = shape.t
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  if (progress < 1) {
    const length = backFlowLength(path)
    ctx.setLineDash([length * progress, length + 1])
  }
  ctx.stroke()
}

/** Label area: the straight run along the lane. */
function getBackFlowLabelRect(shape: BackFlowShape, orientation: SankeyOrientation) {
  const { points } = backFlowPath(shape)
  const u = Math.min(points[2].u, points[3].u)
  const length = Math.abs(points[2].u - points[3].u)
  const w = shape.lane - shape.t / 2
  return orientation === 'vertical'
    ? { height: length, width: shape.t, x: w, y: u }
    : { height: shape.t, width: length, x: u, y: w }
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
  /** true when the flow does not go to a later column and is routed around the content */
  back = false
  /** center of the lane on the cross axis (back flows) */
  lane = 0
  /** distance of the turns from the node edges (back flows) */
  reach = 0
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
    const shape = this.back ? toBackFlowShape(this, this.getClearance(), orientation) : undefined
    if (progress < 1 && !shape) {
      clipFlow(ctx, geometry, progress, orientation)
    }

    setStyle(ctx, this)
    if (shape) {
      drawBackFlow(ctx, shape, progress, orientation)
    } else {
      drawFlowPath(ctx, geometry, controls, orientation)
    }

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const labelRect = shape
        ? getBackFlowLabelRect(shape, orientation)
        : getLabelRect(geometry, orientation)
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
    if (this.back) {
      const vertical = this.options.orientation === 'vertical'
      const point = vertical ? { u: mouseY, w: mouseX } : { u: mouseX, w: mouseY }
      return isOnBackFlow(point, this.getBackShape(useFinalPosition))
    }
    return this.inForwardRange(mouseX, mouseY, useFinalPosition)
  }

  private inForwardRange(mouseX: number, mouseY: number, useFinalPosition: boolean): boolean {
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

  private getClearance(): number {
    return backFlowClearance(this.from !== undefined && this.from === this.to)
  }

  private getBackShape(useFinalPosition: boolean): BackFlowShape {
    const props = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height', 'width', 'lane', 'reach'],
      useFinalPosition
    )
    return toBackFlowShape(props, this.getClearance(), this.options.orientation)
  }

  private getBackBounds(useFinalPosition: boolean) {
    const orientation = this.options.orientation
    const { uMax, uMin, wMax, wMin } = backFlowBounds(this.getBackShape(useFinalPosition))
    return orientation === 'vertical'
      ? { xMax: wMax, xMin: wMin, yMax: uMax, yMin: uMin }
      : { xMax: uMax, xMin: uMin, yMax: wMax, yMin: wMin }
  }

  /**
   * @param {number} mouseX
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    if (this.back) {
      const box = this.getBackBounds(useFinalPosition)
      return mouseX >= box.xMin && mouseX <= box.xMax
    }
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
    if (this.back) {
      const box = this.getBackBounds(useFinalPosition)
      return mouseY >= box.yMin && mouseY <= box.yMax
    }
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
    if (this.back) {
      // middle of the straight run along the lane, which is on the band
      const shape = this.getBackShape(useFinalPosition)
      const { points } = backFlowPath(shape)
      return fromUW({ u: (points[2].u + points[3].u) / 2, w: shape.lane }, this.options.orientation)
    }
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
