import type { ChartMeta, Scale } from 'chart.js'
import type Flow from './flow.js'
import type { BackFlowLayout } from './lib/back-flows.js'
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
import { toFont, toPadding, valueOrDefault } from 'chart.js/helpers'

import { drawLabel, measureLabelRoom, resolveNodeOption } from './labels.js'
import { columnSpace, laneCenter, laneReach, NO_BACK_FLOWS } from './lib/back-flows.js'
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
  columnLead: number,
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
      y:
        getColumnPixel(yScale, parsed.y, maxColumn, columnPadding, columnLead) +
        nodeWidth +
        borderSpace,
      y2: getColumnPixel(yScale, custom.y, maxColumn, columnPadding, columnLead) - borderSpace,
    }
  }
  return {
    flow: custom.flow,
    from: custom.from,
    height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
    to: custom.to,
    width: 0,
    x:
      getColumnPixel(xScale, parsed.x, maxColumn, columnPadding, columnLead) +
      nodeWidth +
      borderSpace,
    x2: getColumnPixel(xScale, custom.x, maxColumn, columnPadding, columnLead) - borderSpace,
    y,
    y2: yScale.getPixelForValue(custom.y),
  }
}

/**
 * Pixel of a column. `padding` is room taken from the end of the column axis
 * (the last column is moved that far from the end), `lead` from its start.
 */
function getColumnPixel(scale: Scale, value: number, maxColumn: number, padding: number, lead = 0) {
  const pixel = scale.getPixelForValue(value)
  return maxColumn ? pixel - (value / maxColumn) * (padding + lead) + lead : pixel + lead
}

function getBorderSpace(borderWidth: number | undefined): number {
  return borderWidth ? borderWidth / 2 + 0.5 : 0
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

/** Pixels per value unit on the cross axis (the axis the flow thickness is measured on). */
function getCrossScale(xScale: Scale, yScale: Scale, orientation: SankeyOrientation): Scale {
  return orientation === 'vertical' ? xScale : yScale
}

function getPixelsPerUnit(scale: Scale): number {
  return Math.abs(scale.getPixelForValue(1) - scale.getPixelForValue(0))
}

/**
 * Room along the column axis, in pixels: `padding` is taken from the end of the
 * axis (the last column is moved that far from the end), `lead` from its start.
 */
interface ColumnRoom {
  padding: number
  lead: number
}

/**
 * Lengths of the chart's axes, in pixels, before the layout has run, so the
 * scales (and chartArea) are not known yet: the chart minus its padding.
 */
function getAxisLengths(
  chart: { height: number; options: { layout?: { padding?: unknown } }; width: number },
  orientation: SankeyOrientation
) {
  const padding = toPadding(chart.options.layout?.padding as number | undefined)
  const horizontal = chart.width - padding.width
  const vertical = chart.height - padding.height
  return orientation === 'vertical'
    ? { column: vertical, trailing: padding.bottom }
    : { column: horizontal, trailing: padding.right }
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
  columnLead: number,
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
      y: getColumnPixel(yScale, nodeX(node), maxColumn, columnPadding, columnLead),
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
    x: getColumnPixel(xScale, nodeX(node), maxColumn, columnPadding, columnLead),
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

// Axis along which flows are ordered by column, read from the controller's
// resolved options so that `orientation` set at chart level counts too. The raw
// dataset only has it when it was given at dataset level.
function columnAxis(ctx: any): 'x' | 'y' {
  const controller = ctx.chart.getDatasetMeta(ctx.datasetIndex).controller
  return controller.options.orientation === 'vertical' ? 'y' : 'x'
}

/** Label position that puts a label outside the first (`before`) or last (`after`) column. */
const OUTWARD_LABEL = {
  horizontal: { after: 'right', before: 'left' },
  vertical: { after: 'bottom', before: 'top' },
} as const

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
        properties: ['x', 'y', 'x2', 'y2', 'height', 'width', 'lane', 'reach'],
        type: 'number',
      },
      progress: {
        delay: (ctx: any) =>
          ctx.type === 'data' ? ctx.parsed[columnAxis(ctx)] * 500 + ctx.dataIndex * 20 : undefined,
        duration: (ctx: any) => {
          if (ctx.type !== 'data') return undefined
          const columns = ctx.parsed._custom[columnAxis(ctx)] - ctx.parsed[columnAxis(ctx)]
          // a back flow goes around the content: take at least a column's time
          return (columns > 0 ? columns : 1 - columns) * 200
        },
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
  private _backFlows: BackFlowLayout = NO_BACK_FLOWS

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

    const axes = getAxisLengths(this.chart, orientation)
    const nodeWidth = this.options.nodeWidth ?? 10
    const { maxX, maxY, backFlows } = layout(nodes, sankeyData, {
      columnAxis: {
        borderSpace: getBorderSpace(this.options.borderWidth),
        labelRoom: (node, side) => this._labelRoom(node, side, orientation),
        length: axes.column,
        nodeWidth,
        padding: Math.max(0, nodeWidth + 3 - axes.trailing),
      },
      height: orientation === 'vertical' ? this.chart.width : this.chart.height,
      modeX: this.options.modeX,
      nodeMinSize: nodeMinSizes,
      nodePadding: nodeGaps,
      nodePaddingMode: this.options.nodePaddingMode,
      priority: !!this.options.priority,
    })

    this._maxX = maxX
    this._backFlows = backFlows
    // the axis also covers the lanes of the back flows
    this._maxY = maxY + backFlows.reserve

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

  override buildOrUpdateElements(resetNewElements?: boolean) {
    // Chart.js only rebuilds `this.options` inside `configure()`, which it calls
    // from `_updateDatasets` -- after `buildOrUpdateElements` (and the parsing it
    // triggers) has already run. The sankey layout is computed while parsing, so
    // without this, a runtime option change (nodePadding, nodePaddingMode,
    // nodeMinSize, modeX, priority, parsing, ...) would only take effect on the
    // *next* update, using the previous update's resolved options in the meantime.
    this.configure()
    super.buildOrUpdateElements(resetNewElements)
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
    const borderSpace = getBorderSpace(borderWidth)
    const crossScale = getCrossScale(xScale, yScale, orientation)
    const backFlows = this._backFlows
    const { padding: columnPadding, lead: columnLead } = this._getColumnRoom()
    const unit = getPixelsPerUnit(crossScale)
    const contentEnd = crossScale.getPixelForValue(backFlows.content)
    const lanes = new Map(backFlows.lanes.map((lane) => [lane.index, lane]))

    for (let i = start; i < start + count; i++) {
      const parsed = this.getParsed(i) as SankeyParsedData
      const lane = lanes.get(i)
      this.updateElement(
        elems[i],
        i,
        {
          back: !!lane,
          options: this.resolveDataElementOptions(i, mode),
          progress: mode === 'reset' ? 0 : 1,
          ...getFlowElementProperties(
            parsed,
            xScale,
            yScale,
            this._maxX,
            nodeWidth,
            columnPadding,
            columnLead,
            borderSpace,
            orientation
          ),
          ...(lane
            ? { lane: laneCenter(lane, contentEnd, unit), reach: laneReach(lane, unit) }
            : { lane: 0, reach: 0 }),
        },
        mode
      )
    }

    if (sharedOptions) {
      this.updateSharedOptions(sharedOptions, mode, firstOpts)
    }
  }

  private _getColumnRoom(): ColumnRoom {
    const { borderWidth, nodeWidth = 10, orientation = 'horizontal' } = this.options
    const { xScale, yScale } = this._cachedMeta
    const padding = getColumnPadding(nodeWidth, orientation, this.chart)
    const { labelAfter, labelBefore, lanes } = this._backFlows
    if (!xScale || !yScale || !lanes.length) return { lead: 0, padding }

    const space = columnSpace(
      lanes,
      this._maxX,
      getPixelsPerUnit(getCrossScale(xScale, yScale, orientation)),
      { borderSpace: getBorderSpace(borderWidth), labelAfter, labelBefore, nodeWidth, padding }
    )
    return { lead: space.lead, padding: space.padding }
  }

  /**
   * Room the label of a node takes outside the first (`before`) or last
   * (`after`) column, where the turns of the back flows are. A label placed
   * inside the chart (which is what 'auto' does) takes none.
   */
  private _labelRoom(node: SankeyNode, side: 'before' | 'after', orientation: SankeyOrientation) {
    const options = this.options
    const style = resolveNodeLabelStyle(options, node)
    const outward = OUTWARD_LABEL[orientation][side]
    if (!style.display || style.position !== outward) return 0

    const font = toFont(
      style.font ?? options.font ?? this.chart.options.font ?? Chart.defaults.font
    )
    return measureLabelRoom(
      this.chart.ctx,
      options.labels?.[node.key] ?? node.key,
      { borderWidth: options.borderWidth ?? 1, font, padding: style.padding },
      outward
    )
  }

  private _drawLabels() {
    const ctx = this.chart.ctx
    const options = this.options
    const nodes = this._nodes || new Map()
    const size = validateSizeValue(options.size)
    const labels = options.labels
    const { borderWidth = 1, nodeWidth = 10, orientation = 'horizontal' } = options
    const defaultFont = options.font ?? this.chart.options.font ?? Chart.defaults.font
    const { xScale, yScale } = this._cachedMeta

    if (!xScale || !yScale) return

    const { padding: columnPadding, lead: columnLead } = this._getColumnRoom()

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
        columnLead,
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
    const sizeMethod = validateSizeValue(size)
    const { xScale, yScale } = this._cachedMeta
    if (!xScale || !yScale) return

    const { padding: columnPadding, lead: columnLead } = this._getColumnRoom()

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
        columnLead,
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
