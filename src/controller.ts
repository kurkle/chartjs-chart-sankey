import type { ChartMeta, Scale } from 'chart.js'
import type Flow from './flow.js'
import type {
  AnyObject,
  FlowConfig,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyNodeGap,
  SankeyOrientation,
  SankeyParsedData,
} from './types.js'

import { Chart, DatasetController } from 'chart.js'
import { toFont, valueOrDefault } from 'chart.js/helpers'

import { drawLabel, resolveNodeOption } from './labels.js'
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

/**
 * The node's drawn rectangle. Along the flow axis, the natural (flow-space)
 * span is stretched -- never shrunk -- to at least `minSize` CSS pixels,
 * growing symmetrically around the node's real center so half the stretch
 * lands above/left and half below/right. `minSize` only affects the drawn
 * rectangle here: the flows attached to the node keep their own exact pixel
 * positions (computed independently in `getFlowElementProperties`), so a
 * stretched node bar does not move or resize any data.
 */
function getNodeRect(
  node: SankeyNode,
  size: number,
  xScale: Scale,
  yScale: Scale,
  maxColumn: number,
  nodeWidth: number,
  columnPadding: number,
  orientation: SankeyOrientation,
  minSize: number
) {
  if (orientation === 'vertical') {
    const x1 = xScale.getPixelForValue(nodeY(node))
    const x2 = xScale.getPixelForValue(nodeY(node) + size)
    const left = Math.min(x1, x2)
    const naturalWidth = Math.abs(x2 - x1)
    const width = Math.max(naturalWidth, minSize)
    return {
      height: nodeWidth,
      width,
      x: left - (width - naturalWidth) / 2,
      y: getColumnPixel(yScale, nodeX(node), maxColumn, columnPadding),
    }
  }
  const y1 = yScale.getPixelForValue(nodeY(node))
  const y2 = yScale.getPixelForValue(nodeY(node) + size)
  const top = Math.min(y1, y2)
  const naturalHeight = Math.abs(y2 - y1)
  const height = Math.max(naturalHeight, minSize)
  return {
    height,
    width: nodeWidth,
    x: getColumnPixel(xScale, nodeX(node), maxColumn, columnPadding),
    y: top - (height - naturalHeight) / 2,
  }
}

function resolveNodeGap(
  option: SankeyControllerDatasetOptions['nodePadding'],
  node: SankeyNode
): Required<SankeyNodeGap> {
  const resolved = resolveNodeOption(option ?? 10, node) ?? 10
  if (typeof resolved === 'number') {
    return { after: resolved, before: resolved }
  }
  return { after: resolved.after ?? 10, before: resolved.before ?? 10 }
}

function resolveNodeMinSize(
  option: SankeyControllerDatasetOptions['nodeMinSize'],
  node: SankeyNode
): number {
  return resolveNodeOption(option ?? 0, node) ?? 0
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
    backgroundColor: resolveNodeOption(backgroundColor, node),
    borderRadius,
    color: resolveNodeOption(color, node) ?? options.color ?? 'black',
    display: resolveNodeOption(display, node) ?? true,
    font,
    padding,
    position: resolveNodeOption(position, node) ?? 'auto',
  }
}

// Node-scoped options resolve per node (value | Record | (node) => value), so
// Chart.js must not call their function form with its own scriptable context.
const NODE_SCOPED_OPTIONS = new Set(['nodeMinSize', 'nodePadding'])

export default class SankeyController extends DatasetController {
  static readonly id = 'sankey'

  static readonly descriptors = {
    _indexable: false,
    _scriptable: (name: string) => !NODE_SCOPED_OPTIONS.has(name),
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
    nodeMinSize: 0,
    nodePadding: 10,
    nodePaddingMode: 'auto',
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
      resize: {
        animations: {
          progress: { delay: 0, duration: 0 },
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

    const nodeGaps = new Map<string, Required<SankeyNodeGap>>()
    const nodeMinSizes = new Map<string, number>()
    for (const node of nodes.values()) {
      nodeGaps.set(node.key, resolveNodeGap(this.options.nodePadding, node))
      nodeMinSizes.set(node.key, resolveNodeMinSize(this.options.nodeMinSize, node))
    }

    const { maxX, maxY } = layout(nodes, sankeyData, {
      height: orientation === 'vertical' ? this.chart.width : this.chart.height,
      modeX: this.options.modeX,
      nodeMinSize: nodeMinSizes,
      nodePadding: nodeGaps,
      nodePaddingMode: this.options.nodePaddingMode,
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
      const minSize = resolveNodeMinSize(options.nodeMinSize, node)
      const { height, width, x, y } = getNodeRect(
        node,
        max,
        xScale,
        yScale,
        this._maxX,
        nodeWidth,
        columnPadding,
        orientation,
        minSize
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
      const minSize = resolveNodeMinSize(this.options.nodeMinSize, node)
      const { height, width, x, y } = getNodeRect(
        node,
        max,
        xScale,
        yScale,
        this._maxX,
        nodeWidth,
        columnPadding,
        orientation,
        minSize
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
