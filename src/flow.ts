import type { Color } from 'chart.js'
import type { ShapeProps } from './lib/flow-shapes.js'
import type { FlowConfig, FlowOptions, FlowPoint, FlowProps, SankeyNode } from './types.js'

import { Chart, Element } from 'chart.js'
import { color, getHoverColor, toFont } from 'chart.js/helpers'

import { drawLabel } from './labels.js'
import { shapeOf } from './lib/flow-shapes.js'

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
  /** center of the lane on the cross axis (back flows) */
  lane = 0
  /** distance of the turns from the node edges, beyond their radius (back flows) */
  reach = 0
  /** inner radius of the turns (back flows) */
  clear = 0
  /** anchor points of a flow that skips columns, see `FlowRoute` */
  points?: FlowPoint[]
  from?: SankeyNode
  to?: SankeyNode

  constructor(cfg: FlowConfig) {
    super()

    if (cfg) {
      Object.assign(this, cfg)
    }
  }

  /** The shape of the flow, picked by what kind of flow it is. */
  private shape(useFinalPosition = false) {
    const props = this.getProps(
      ['x', 'y', 'x2', 'y2', 'height', 'width', 'points', 'lane', 'reach', 'clear'],
      useFinalPosition
    ) as Omit<ShapeProps, 'orientation'>
    return shapeOf(this.back, { ...props, orientation: this.options.orientation })
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx: CanvasRenderingContext2D) {
    if (this.progress === 0) {
      return
    }
    const shape = this.shape()
    ctx.save()
    setStyle(ctx, this)
    shape.draw(ctx, this.progress)

    const labels = this.options.flowLabels
    if (labels.display) {
      const font = toFont(labels.font ?? Chart.defaults.font)
      const rect = shape.labelRect()
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
    return this.shape(useFinalPosition).contains(mouseX, mouseY)
  }

  inXRange(mouseX: number, useFinalPosition: boolean): boolean {
    const { xMax, xMin } = this.shape(useFinalPosition).box()
    return mouseX >= xMin && mouseX <= xMax
  }

  inYRange(mouseY: number, useFinalPosition: boolean): boolean {
    const { yMax, yMin } = this.shape(useFinalPosition).box()
    return mouseY >= yMin && mouseY <= yMax
  }

  getCenterPoint(useFinalPosition: boolean): { x: number; y: number } {
    return this.shape(useFinalPosition).center()
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
