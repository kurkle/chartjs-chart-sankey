import type { ChartMeta } from 'chart.js'
import type Flow from './flow.js'
import type { Geometry } from './lib/geometry.js'
import type { Plan, PlanLink } from './lib/topology.js'
import type {
  AnyObject,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyNodeGap,
  SankeyOrientation,
  SankeyParsedData,
} from './types.js'

import { Chart, DatasetController } from 'chart.js'
import { toFont, valueOrDefault } from 'chart.js/helpers'

import { drawLabel, resolveNodeOption } from './labels.js'
import { getParsedData } from './lib/core.js'
import { computeGeometry } from './lib/geometry.js'
import { toTextLines } from './lib/helpers.js'
import { buildTopology } from './lib/topology.js'

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

/**
 * Flows are not positioned in the parsed data: `parsed.x`/`parsed.y` hold the
 * column of the source on the column axis (x when horizontal, y when
 * vertical) and `_custom.x`/`_custom.y` the column of the target, which is
 * what the flow animation staggers by. Pixel geometry is set in `update`.
 */
function parseFlow(link: PlanLink, orientation: SankeyOrientation): SankeyParsedData {
  const fromColumn = link.from.x ?? 0
  const toColumn = link.to.x ?? 0
  const vertical = orientation === 'vertical'
  return {
    _custom: {
      flow: link.flow,
      from: link.from,
      height: link.flow,
      to: link.to,
      x: vertical ? 0 : toColumn,
      y: vertical ? toColumn : 0,
    },
    x: vertical ? 0 : fromColumn,
    y: vertical ? fromColumn : 0,
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
          ctx.type === 'data' ? ctx.parsed[columnAxis(ctx)] * 500 + ctx.dataIndex * 20 : undefined,
        duration: (ctx: any) =>
          ctx.type === 'data'
            ? (ctx.parsed._custom[columnAxis(ctx)] - ctx.parsed[columnAxis(ctx)]) * 200
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
        right: 3,
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
  private _plan: Plan | undefined
  private _planKey: string | undefined
  private _geometry: Geometry | undefined
  // Orientation used by the previous update; undefined until the first one.
  private _orientation: SankeyOrientation | undefined

  override parseObjectData(
    _meta: ChartMeta<'sankey', Flow>,
    data: AnyObject[],
    start: number,
    count: number
  ): SankeyParsedData[] {
    const sankeyData = getParsedData(data, this.options.parsing)
    const orientation = this.options.orientation ?? 'horizontal'
    // Topology only: nothing here depends on the size of the chart. Chart.js
    // parses on every update, a resize included, so an unchanged plan is kept.
    const { column, modeX, priority, size } = this.options
    const key = JSON.stringify([sankeyData, column, modeX, priority, size])
    if (!this._plan || key !== this._planKey) {
      this._plan = buildTopology(sankeyData, this.options)
      this._planKey = key
    }
    const plan = this._plan

    const parsed = plan.links.map((link) => parseFlow(link, orientation))
    return parsed.slice(start, start + count)
  }

  override buildOrUpdateElements(resetNewElements?: boolean) {
    // Chart.js only rebuilds `this.options` inside `configure()`, which it calls
    // from `_updateDatasets` -- after `buildOrUpdateElements` (and the parsing it
    // triggers) has already run. The topology is worked out while parsing, so
    // without this, a runtime option change (modeX, priority, column, size,
    // parsing, ...) would only take effect on the *next* update, using the
    // previous update's resolved options in the meantime.
    this.configure()
    super.buildOrUpdateElements(resetNewElements)
  }

  override getMinMax(scale: any) {
    // The scales are not used for positioning; keep their range trivial.
    const vertical = this.options.orientation === 'vertical'
    const columnScale = vertical ? this._cachedMeta.yScale : this._cachedMeta.xScale
    return { max: scale === columnScale ? (this._plan?.maxColumn ?? 0) : 1, min: 0 }
  }

  override update(mode: any) {
    const { data } = this._cachedMeta as ChartMeta<'sankey', Flow>
    const orientation = this.options.orientation ?? 'horizontal'

    // The chart area is final here (title, legend and layout padding already
    // taken off), so the layout can be done in pixels.
    this._geometry = this._computeGeometry()

    // Flow geometry (x, y, x2, y2, height, width) is only meaningful together
    // with the orientation it was computed for, so it must not be tweened from
    // one orientation's coordinates to the other's. Snap to the new geometry
    // with `progress` at 0, like a first render, and let the update below play
    // the reveal.
    if (this._orientation !== undefined && this._orientation !== orientation) {
      this.updateElements(data, 0, data.length, 'reset')
    }
    this._orientation = orientation

    this.updateElements(data, 0, data.length, mode)
  }

  private _computeGeometry(): Geometry | undefined {
    const plan = this._plan
    const { chartArea } = this.chart
    if (!plan || !chartArea) return undefined
    const options = this.options
    const gaps = new Map<string, Required<SankeyNodeGap>>()
    const minSizes = new Map<string, number>()
    for (const node of plan.nodes.values()) {
      gaps.set(node.key, resolveNodeGap(options.nodePadding, node))
      minSizes.set(node.key, resolveNodeMinSize(options.nodeMinSize, node))
    }
    const orientation = options.orientation ?? 'horizontal'
    return computeGeometry(plan, {
      area: chartArea,
      borderWidth: options.borderWidth ?? 0,
      gaps,
      insets: this._measureLabelInsets(plan, orientation),
      minSizes,
      nodeWidth: options.nodeWidth ?? 10,
      orientation,
      paddingMode: options.nodePaddingMode === 'even' ? 'even' : 'auto',
    })
  }

  /**
   * Labels that the user placed outside the first or the last column need room
   * beyond it. Labels in automatic position are drawn over the chart and need
   * none.
   */
  private _measureLabelInsets(plan: Plan, orientation: SankeyOrientation) {
    const insets = { end: 0, start: 0 }
    const vertical = orientation === 'vertical'
    const startPosition = vertical ? 'top' : 'left'
    const endPosition = vertical ? 'bottom' : 'right'
    for (const node of plan.nodes.values()) {
      const style = resolveNodeLabelStyle(this.options, node)
      const atStart = node.x === 0 && style.position === startPosition
      const atEnd = node.x === plan.maxColumn && style.position === endPosition
      if (!style.display || !(atStart || atEnd)) continue

      const room = this._labelRoom(node, style, vertical)
      if (atStart) insets.start = Math.max(insets.start, room)
      if (atEnd) insets.end = Math.max(insets.end, room)
    }
    return insets
  }

  /** Space a label takes next to its node along the column axis. */
  private _labelRoom(
    node: SankeyNode,
    style: ReturnType<typeof resolveNodeLabelStyle>,
    vertical: boolean
  ) {
    const { borderWidth = 1, font: datasetFont, labels } = this.options
    const ctx = this.chart.ctx
    const font = toFont(style.font ?? datasetFont ?? this.chart.options.font ?? Chart.defaults.font)
    const lines = toTextLines(labels?.[node.key] ?? node.key)
    ctx.save()
    ctx.font = font.string
    const text = vertical
      ? lines.length * font.lineHeight
      : Math.max(0, ...lines.map((line) => ctx.measureText(line).width))
    ctx.restore()
    const padding = style.padding * (style.backgroundColor === undefined ? 1 : 2)
    return text + padding + (vertical ? 0 : borderWidth)
  }

  override updateElements(
    elems: Flow[],
    start: number,
    count: number,
    mode: 'default' | 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'active'
  ) {
    const geometry = this._geometry
    if (!geometry) return

    const firstOpts = this.resolveDataElementOptions(start, mode)
    const sharedOptions = this.getSharedOptions(firstOpts)
    const parsedLinks = this._plan?.links ?? []

    for (let i = start; i < start + count; i++) {
      const link = parsedLinks[i]
      if (!link) continue
      this.updateElement(
        elems[i],
        i,
        {
          flow: link.flow,
          from: link.from,
          options: this.resolveDataElementOptions(i, mode),
          progress: mode === 'reset' ? 0 : 1,
          to: link.to,
          ...geometry.flows[i],
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
    const nodes = this._plan?.nodes ?? new Map()
    const labels = options.labels
    const { borderWidth = 1, orientation = 'horizontal' } = options
    const defaultFont = options.font ?? this.chart.options.font ?? Chart.defaults.font
    const rects = this._geometry?.nodes

    if (!rects) return

    ctx.save()
    const chartArea = this.chart.chartArea
    for (const node of nodes.values()) {
      const rect = rects.get(node.key)
      if (!rect) continue
      const { height, width, x, y } = rect
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
    const nodes = this._plan?.nodes ?? new Map()
    const { borderColor, borderWidth = 0 } = this.options
    const rects = this._geometry?.nodes
    if (!rects) return

    ctx.save()
    if (borderColor && borderWidth) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
    }

    for (const node of nodes.values()) {
      const rect = rects.get(node.key)
      if (!rect) continue
      ctx.fillStyle = node.color ?? 'black'
      if (borderWidth) {
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
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
