import type { ChartMeta, Scale } from 'chart.js'
import type Flow from './flow.js'
import type {
  AnyObject,
  FlowConfig,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyOrientation,
  SankeyParsedData,
} from './types.js'

import { Chart, DatasetController } from 'chart.js'
import { toFont, valueOrDefault } from 'chart.js/helpers'

import { drawLabel, resolveNodeLabelOption } from './labels.js'
import { buildNodesFromData, getParsedData } from './lib/core.js'
import { validateSizeValue } from './lib/helpers.js'
import { layout } from './lib/layout.js'

function nodeX(node: SankeyNode): number {
  return node.x ?? 0
}

function nodeY(node: SankeyNode): number {
  return node.y ?? 0
}

function getNodeSize(node: SankeyNode, size: 'min' | 'max') {
  return Math[size](node.in || node.out, node.out || node.in)
}

function getAutoLabelPosition(
  x: number,
  y: number,
  chartArea: { bottom: number; left: number; right: number; top: number },
  orientation: SankeyOrientation
) {
  if (orientation === 'vertical') {
    return y < (chartArea.top + chartArea.bottom) / 2 ? ('bottom' as const) : ('top' as const)
  }
  return x < (chartArea.left + chartArea.right) / 2 ? ('right' as const) : ('left' as const)
}

function getAddY(arr: FromToElement[], key: string, index: number): number {
  for (const item of arr) {
    if (item.key === key && item.index === index) {
      return item.addY
    }
  }
  return 0
}

function parseFlow(
  from: SankeyNode,
  to: SankeyNode,
  fromY: number,
  toY: number,
  flow: number,
  index: number,
  xScale: Scale,
  yScale: Scale,
  orientation: SankeyOrientation
): SankeyParsedData {
  if (orientation === 'vertical') {
    return {
      _custom: {
        flow,
        from,
        height: xScale.parse(flow, index) as number,
        to,
        x: xScale.parse(toY, index) as number,
        y: yScale.parse(nodeX(to), index) as number,
      },
      x: xScale.parse(fromY, index) as number,
      y: yScale.parse(nodeX(from), index) as number,
    }
  }
  return {
    _custom: {
      flow,
      from,
      height: yScale.parse(flow, index) as number,
      to,
      x: xScale.parse(nodeX(to), index) as number,
      y: yScale.parse(toY, index) as number,
    },
    x: xScale.parse(nodeX(from), index) as number,
    y: yScale.parse(fromY, index) as number,
  }
}

function getFlowElementProperties(
  parsed: SankeyParsedData,
  xScale: Scale,
  yScale: Scale,
  maxColumn: number,
  nodeWidth: number,
  columnPadding: number,
  borderSpace: number,
  orientation: SankeyOrientation
): Omit<FlowConfig, 'options'> {
  const custom = parsed._custom
  const x = xScale.getPixelForValue(parsed.x)
  const y = yScale.getPixelForValue(parsed.y)
  if (orientation === 'vertical') {
    return {
      flow: custom.flow,
      from: custom.from,
      height: 0,
      to: custom.to,
      width: Math.abs(xScale.getPixelForValue(parsed.x + custom.height) - x),
      x,
      x2: xScale.getPixelForValue(custom.x),
      y: getColumnPixel(yScale, parsed.y, maxColumn, columnPadding) + nodeWidth + borderSpace,
      y2: getColumnPixel(yScale, custom.y, maxColumn, columnPadding) - borderSpace,
    }
  }
  return {
    flow: custom.flow,
    from: custom.from,
    height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
    to: custom.to,
    width: 0,
    x: getColumnPixel(xScale, parsed.x, maxColumn, columnPadding) + nodeWidth + borderSpace,
    x2: getColumnPixel(xScale, custom.x, maxColumn, columnPadding) - borderSpace,
    y,
    y2: yScale.getPixelForValue(custom.y),
  }
}

function getColumnPixel(scale: Scale, value: number, maxColumn: number, padding: number) {
  const pixel = scale.getPixelForValue(value)
  return maxColumn ? pixel - (value / maxColumn) * padding : pixel
}

function getColumnPadding(
  nodeWidth: number,
  orientation: SankeyOrientation,
  chart: { chartArea: { bottom: number; right: number }; height: number; width: number }
) {
  const trailingSpace =
    orientation === 'vertical'
      ? chart.height - chart.chartArea.bottom
      : chart.width - chart.chartArea.right
  return Math.max(0, nodeWidth + 3 - trailingSpace)
}

function getNodeRect(
  node: SankeyNode,
  size: number,
  xScale: Scale,
  yScale: Scale,
  maxColumn: number,
  nodeWidth: number,
  columnPadding: number,
  orientation: SankeyOrientation
) {
  if (orientation === 'vertical') {
    const x = xScale.getPixelForValue(nodeY(node))
    return {
      height: nodeWidth,
      width: Math.abs(xScale.getPixelForValue(nodeY(node) + size) - x),
      x,
      y: getColumnPixel(yScale, nodeX(node), maxColumn, columnPadding),
    }
  }
  const y = yScale.getPixelForValue(nodeY(node))
  return {
    height: Math.abs(yScale.getPixelForValue(nodeY(node) + size) - y),
    width: nodeWidth,
    x: getColumnPixel(xScale, nodeX(node), maxColumn, columnPadding),
    y,
  }
}

function resolveNodeLabelStyle(options: SankeyControllerDatasetOptions, node: SankeyNode) {
  const {
    backgroundColor,
    borderRadius = 0,
    color,
    display,
    font,
    padding = 4,
    position,
  } = options.nodeLabels ?? {}
  return {
    backgroundColor: resolveNodeLabelOption(backgroundColor, node),
    borderRadius,
    color: resolveNodeLabelOption(color, node) ?? options.color ?? 'black',
    display: resolveNodeLabelOption(display, node) ?? true,
    font,
    padding,
    position: resolveNodeLabelOption(position, node) ?? 'auto',
  }
}

export default class SankeyController extends DatasetController {
  static readonly id = 'sankey'

  static readonly descriptors = {
    _indexable: false,
    _scriptable: true,
    nodeLabels: {
      _indexable: false,
      _scriptable: false,
    },
  }

  static readonly defaults = {
    animations: {
      colors: {
        properties: ['colorFrom', 'colorTo'],
        type: 'color',
      },
      numbers: {
        properties: ['x', 'y', 'x2', 'y2', 'height', 'width'],
        type: 'number',
      },
      progress: {
        delay: (ctx: any) =>
          ctx.type === 'data'
            ? ctx.parsed[ctx.dataset.orientation === 'vertical' ? 'y' : 'x'] * 500 +
              ctx.dataIndex * 20
            : undefined,
        duration: (ctx: any) =>
          ctx.type === 'data'
            ? (ctx.parsed._custom[ctx.dataset.orientation === 'vertical' ? 'y' : 'x'] -
                ctx.parsed[ctx.dataset.orientation === 'vertical' ? 'y' : 'x']) *
              200
            : undefined,
        easing: 'linear',
      },
    },
    borderColor: 'black',
    borderWidth: 1,
    color: 'black',
    dataElementType: 'flow',
    modeX: 'edge',
    nodePadding: 10,
    nodeWidth: 10,
    orientation: 'horizontal',
    transitions: {
      hide: {
        animations: {
          colors: {
            properties: ['colorFrom', 'colorTo'],
            to: 'transparent',
            type: 'color',
          },
        },
      },
      show: {
        animations: {
          colors: {
            from: 'transparent',
            properties: ['colorFrom', 'colorTo'],
            type: 'color',
          },
        },
      },
    },
  }

  static readonly overrides = {
    datasets: {
      clip: false,
      parsing: { flow: 'flow', from: 'from', to: 'to' },
    },
    interaction: {
      intersect: true,
      mode: 'nearest',
    },
    layout: {
      padding: {
        bottom: 3,
        left: 3,
        right: 13,
        top: 3,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context: any) {
            const parsedCustom = context.parsed._custom
            return `${parsedCustom.from.key} -> ${parsedCustom.to.key}: ${parsedCustom.flow}`
          },
          title() {
            return ''
          },
        },
      },
    },
    scales: {
      x: {
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
        type: 'linear',
      },
      y: {
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
        reverse: true,
        type: 'linear',
      },
    },
  }

  declare options: SankeyControllerDatasetOptions
  private _nodes = new Map<string, SankeyNode>()
  private _maxX = 0
  private _maxY = 0

  override parseObjectData(
    meta: ChartMeta<'sankey', Flow>,
    data: AnyObject[],
    start: number,
    count: number
  ): SankeyParsedData[] {
    const sankeyData = getParsedData(data, this.options.parsing)
    const { xScale, yScale } = meta
    const parsed: SankeyParsedData[] = []
    const nodes = buildNodesFromData(sankeyData, this.options)
    const orientation = this.options.orientation ?? 'horizontal'
    this._nodes = nodes

    const { maxX, maxY } = layout(nodes, sankeyData, {
      height: orientation === 'vertical' ? this.chart.canvas.width : this.chart.canvas.height,
      modeX: this.options.modeX,
      nodePadding: this.options.nodePadding ?? 10,
      priority: !!this.options.priority,
    })

    this._maxX = maxX
    this._maxY = maxY

    if (!xScale || !yScale) return []

    for (let i = 0, ilen = sankeyData.length; i < ilen; ++i) {
      const dataPoint = sankeyData[i]
      const from = nodes.get(dataPoint.from)
      const to = nodes.get(dataPoint.to)
      if (!from || !to) continue

      const fromY: number = nodeY(from) + getAddY(from.to, dataPoint.to, i)
      const toY: number = nodeY(to) + getAddY(to.from, dataPoint.from, i)
      parsed.push(parseFlow(from, to, fromY, toY, dataPoint.flow, i, xScale, yScale, orientation))
    }
    return parsed.slice(start, start + count)
  }

  override getMinMax(scale: any) {
    const vertical = this.options.orientation === 'vertical'
    const columnScale = vertical ? this._cachedMeta.yScale : this._cachedMeta.xScale
    return {
      max: scale === columnScale ? this._maxX : this._maxY,
      min: 0,
    }
  }

  override update(mode: any) {
    const { data } = this._cachedMeta as ChartMeta<'sankey', Flow>

    this.updateElements(data, 0, data.length, mode)
  }

  override updateElements(
    elems: Flow[],
    start: number,
    count: number,
    mode: 'default' | 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'active'
  ) {
    const { xScale, yScale } = this._cachedMeta
    if (!xScale || !yScale) return

    const firstOpts = this.resolveDataElementOptions(start, mode)
    const sharedOptions = this.getSharedOptions(firstOpts)
    const { borderWidth, nodeWidth = 10, orientation = 'horizontal' } = this.options
    const columnPadding = getColumnPadding(nodeWidth, orientation, this.chart)
    const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0

    for (let i = start; i < start + count; i++) {
      const parsed = this.getParsed(i) as SankeyParsedData
      this.updateElement(
        elems[i],
        i,
        {
          options: this.resolveDataElementOptions(i, mode),
          progress: mode === 'reset' ? 0 : 1,
          ...getFlowElementProperties(
            parsed,
            xScale,
            yScale,
            this._maxX,
            nodeWidth,
            columnPadding,
            borderSpace,
            orientation
          ),
        },
        mode
      )
    }

    if (sharedOptions) {
      this.updateSharedOptions(sharedOptions, mode, firstOpts)
    }
  }

  private _drawLabels() {
    const ctx = this.chart.ctx
    const options = this.options
    const nodes = this._nodes || new Map()
    const size = validateSizeValue(options.size)
    const labels = options.labels
    const { borderWidth = 1, nodeWidth = 10, orientation = 'horizontal' } = options
    const columnPadding = getColumnPadding(nodeWidth, orientation, this.chart)
    const defaultFont = options.font ?? this.chart.options.font ?? Chart.defaults.font
    const { xScale, yScale } = this._cachedMeta

    if (!xScale || !yScale) return

    ctx.save()
    const chartArea = this.chart.chartArea
    for (const node of nodes.values()) {
      const max = getNodeSize(node, size)
      const { height, width, x, y } = getNodeRect(
        node,
        max,
        xScale,
        yScale,
        this._maxX,
        nodeWidth,
        columnPadding,
        orientation
      )
      const label = labels?.[node.key] ?? node.key
      const labelStyle = resolveNodeLabelStyle(options, node)
      if (labelStyle.display) {
        const font = toFont(labelStyle.font ?? defaultFont)
        drawLabel(ctx, label, {
          autoPosition: getAutoLabelPosition(x, y, chartArea, orientation),
          backgroundColor: labelStyle.backgroundColor,
          borderRadius: labelStyle.borderRadius,
          borderWidth,
          color: labelStyle.color,
          font,
          height,
          lineOffset: valueOrDefault(options.padding, font.lineHeight / 2),
          padding: labelStyle.padding,
          position: labelStyle.position,
          width,
          x,
          y,
        })
      }
    }
    ctx.restore()
  }

  private _drawNodes() {
    const ctx = this.chart.ctx
    const nodes = this._nodes || new Map()
    const {
      borderColor,
      borderWidth = 0,
      nodeWidth = 10,
      orientation = 'horizontal',
      size,
    } = this.options
    const columnPadding = getColumnPadding(nodeWidth, orientation, this.chart)
    const sizeMethod = validateSizeValue(size)
    const { xScale, yScale } = this._cachedMeta

    ctx.save()
    if (borderColor && borderWidth) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
    }

    for (const node of nodes.values()) {
      ctx.fillStyle = node.color ?? 'black'
      if (!xScale || !yScale) return

      const max = Math[sizeMethod](node.in || node.out, node.out || node.in)
      const { height, width, x, y } = getNodeRect(
        node,
        max,
        xScale,
        yScale,
        this._maxX,
        nodeWidth,
        columnPadding,
        orientation
      )
      if (borderWidth) {
        ctx.strokeRect(x, y, width, height)
      }
      ctx.fillRect(x, y, width, height)
    }
    ctx.restore()
  }

  /**
   * That's where the drawing process happens
   */
  override draw() {
    const ctx = this.chart.ctx
    const data = (this.getMeta().data as Flow[]) ?? []

    // Set node colors
    const active: Flow[] = []
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i] /* Flow at index i */
      if (!flow.from || !flow.to) {
        continue
      }
      flow.from.color = flow.options.colorFrom
      flow.to.color = flow.options.colorTo
      if (flow.active) {
        active.push(flow)
      }
    }

    // Make sure nodes connected to hovered flows are using hover colors.
    for (const flow of active) {
      if (!flow.from || !flow.to) {
        continue
      }
      flow.from.color = flow.options.colorFrom
      flow.to.color = flow.options.colorTo
    }

    this._drawNodes()

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx)
    }

    this._drawLabels()
  }
}
