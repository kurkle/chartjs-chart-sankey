import type { ActiveElement, ChartMeta } from 'chart.js'
import type Flow from './flow.js'
import type { Geometry } from './lib/geometry.js'
import type { Plan, PlanLink } from './lib/topology.js'
import type {
  AnyObject,
  NodeOptions,
  NodeProps,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyNodeGap,
  SankeyOrientation,
  SankeyParsedData,
} from './types.js'

import { Animations, Chart, DatasetController } from 'chart.js'
import { _longestText, toFont, valueOrDefault } from 'chart.js/helpers'

import { interpolateRoute } from './flow.js'
import { registerSankeyMode } from './interaction.js'
import { drawLabel, resolveNodeOption } from './labels.js'
import { getParsedData } from './lib/core.js'
import { computeGeometry } from './lib/geometry.js'
import { toTextLines } from './lib/helpers.js'
import { buildTopology, flowKeys } from './lib/topology.js'
import NodeElement from './node.js'

registerSankeyMode()

type UpdateMode = 'default' | 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'active'

// The parts of the chart's config that resolve animations; Chart.js has them
// but does not type them on `chart.config`.
interface AnimationConfig {
  createResolver(scopes: object[], context: object): { animations?: AnyObject }
  datasetAnimationScopeKeys(type: string, transition: string): string[][]
  getOptionScopes(dataset: object, keys: string[][]): object[]
}

/**
 * Ends the running tweens of an element. Chart.js assigns a direct update
 * (mode `'reset'` or `'none'`, or animations off) without cancelling them, and
 * a running tween would then write its old target over the assigned value.
 */
function endTweens(element: { $animations?: Record<string, { cancel(): void }> }) {
  for (const animation of Object.values(element.$animations ?? {})) {
    animation.cancel()
  }
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
    backFlows: {
      _indexable: false,
      _scriptable: false,
    },
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
        // A back flow runs backwards over the columns, a flow to its own node over none:
        // both take as long as the columns they cover, and at least one.
        duration: (ctx: any) =>
          ctx.type === 'data'
            ? Math.max(
                Math.abs(ctx.parsed._custom[columnAxis(ctx)] - ctx.parsed[columnAxis(ctx)]),
                1
              ) * 200
            : undefined,
        easing: 'linear',
      },
      route: {
        fn: interpolateRoute as (from: unknown, to: unknown, factor: number) => unknown,
        properties: ['route'],
      },
    },
    borderColor: 'black',
    borderWidth: 1,
    color: 'black',
    dataElementType: 'flow',
    modeX: 'edge',
    nodeAlign: 'auto',
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
      mode: 'sankey',
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
    // The scales are not used for positioning; they only stay out of the way.
    scales: {
      x: { display: false, type: 'linear' },
      y: { display: false, type: 'linear' },
    },
  }

  declare options: SankeyControllerDatasetOptions
  // The registered element of `dataElementType`; Chart.js sets it but does not type it.
  declare dataElementType: new () => Flow
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
    const { backFlows, column, modeX, priority, size } = this.options
    const key = JSON.stringify([sankeyData, backFlows, column, modeX, priority, size])
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
    // Chart.js keeps the elements by index, cuts the end off when the data
    // shrinks and gives what it adds the nodes of the new plan, so the old
    // flows and their keys are taken before it runs.
    const before = this._plan
    const old = this._flowsByKey()
    super.buildOrUpdateElements(resetNewElements)
    const plan = this._plan
    if (plan && plan !== before) this._matchFlows(old, plan)
  }

  /** The flows of the plan by key; none for a row without an element (data emptied). */
  private _flowsByKey() {
    const elements = this._cachedMeta.data as Flow[]
    const flows = new Map<string, Flow>()
    flowKeys(this._plan?.links ?? []).forEach((key, i) => {
      if (elements[i]) flows.set(key, elements[i])
    })
    return flows
  }

  /**
   * Gives every row the old flow with its key, or a new element that
   * `update()` places, and moves the active flows of the chart and of its
   * tooltip to their new indices: Chart.js tells active items apart by index.
   */
  private _matchFlows(old: Map<string, Flow>, plan: Plan) {
    const elements = this._cachedMeta.data as Flow[]
    flowKeys(plan.links).forEach((key, j) => {
      elements[j] = old.get(key) ?? new this.dataElementType()
    })
    const flows = new Set<unknown>(old.values())
    const follow = (items: ActiveElement[]) =>
      items.flatMap((item) => {
        if (!flows.has(item.element)) return [item]
        const index = elements.indexOf(item.element as Flow)
        return index < 0 ? [] : [{ ...item, index }]
      })
    const chart = this.chart as unknown as {
      _active: ActiveElement[]
      tooltip?: { _active?: ActiveElement[] }
    }
    chart._active = follow(chart._active)
    if (chart.tooltip?._active) chart.tooltip._active = follow(chart.tooltip._active)
  }

  override update(mode: any) {
    const { data } = this._cachedMeta as ChartMeta<'sankey', Flow>
    const orientation = this.options.orientation ?? 'horizontal'

    // The chart area is final here (title, legend and layout padding already
    // taken off), so the layout can be done in pixels.
    this._geometry = this._computeGeometry()

    // Geometry (of the flows and of the nodes) is only meaningful together
    // with the orientation it was computed for, so it must not be tweened from
    // one orientation's coordinates to the other's. Snap to the new geometry
    // with `progress` at 0, like a first render, and let the update below play
    // the reveal.
    if (this._orientation !== undefined && this._orientation !== orientation) {
      this.updateElements(data, 0, data.length, 'reset')
      this._updateNodes('reset')
    }
    this._orientation = orientation

    // A flow that is new since the last update (it has no nodes yet) starts at
    // its own place with its reveal at the start, so that only the reveal runs.
    // A direct update below assigns every one of these values again, so the
    // guard only saves work: on a first render every flow is new.
    if (!this._isDirect(mode)) {
      data.forEach((flow, j) => {
        if (flow.from === undefined) this.updateElements(data, j, 1, 'reset')
      })
    }
    this.updateElements(data, 0, data.length, mode)
    this._updateNodes(mode)
  }

  /** The elements of the nodes, `meta.nodes`; none before the first update. */
  private _nodeElements(): NodeElement[] {
    return ((this._cachedMeta as AnyObject).nodes ?? []) as NodeElement[]
  }

  /** Whether an update assigns its values at once instead of tweening to them. */
  private _isDirect(mode: UpdateMode) {
    return mode === 'reset' || mode === 'none' || !this.chart.options.animation
  }

  /**
   * Keeps one element per node of the plan in `meta.nodes`, in plan order and
   * matched by key, and moves them to the rectangles of the geometry. A new
   * element is placed at once whatever the mode.
   */
  private _updateNodes(mode: UpdateMode) {
    const meta = this._cachedMeta as AnyObject
    const geometry = this._geometry
    // Without data there is no plan yet (Chart.js parses nothing), and so no node.
    if (!geometry || !this._plan) {
      meta.nodes ??= []
      return
    }

    const old = new Map<string, NodeElement>()
    for (const element of this._nodeElements()) {
      if (element.node) old.set(element.node.key, element)
    }
    const { borderColor, borderWidth = 0 } = this.options
    const nodes: NodeElement[] = []
    for (const node of this._plan.nodes.values()) {
      const rect = geometry.nodes.get(node.key)
      if (!rect) continue
      // A new options object every time: Chart.js writes onto the one an element has.
      const props = { ...rect, node, options: { borderColor, borderWidth } }
      nodes.push(this._updateNode(old.get(node.key), props, mode))
    }
    meta.nodes = nodes
  }

  private _updateNode(
    element: NodeElement | undefined,
    props: NodeProps & { node: SankeyNode; options: NodeOptions },
    mode: UpdateMode
  ) {
    if (!element) {
      return Object.assign(new NodeElement(), props)
    }
    if (this._isDirect(mode)) {
      endTweens(element)
      Object.assign(element, props)
    } else {
      this._nodeAnimations(props.node, mode).update(element, props)
    }
    return element
  }

  /**
   * The animations of a node, resolved as Chart.js resolves those of a flow but
   * with a context of `type: 'node'` that holds the node and no data row.
   */
  private _nodeAnimations(node: SankeyNode, mode: UpdateMode) {
    // Chart.js does not type the dataset context of a controller.
    const dataset = (this as unknown as { getContext(): AnyObject }).getContext()
    const context = Object.assign(Object.create(dataset), {
      active: false,
      mode,
      node,
      type: 'node',
    })

    const config = this.chart.config as unknown as AnimationConfig
    const keys = config.datasetAnimationScopeKeys(this._cachedMeta.type, mode)
    const scopes = config.getOptionScopes(this.getDataset(), keys)
    const resolved = config.createResolver(scopes, context)
    return new Animations(this.chart, resolved.animations ?? {})
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
      // any other value is drawn as 'auto'
      align: (['start', 'end', 'edges'] as const).find((a) => a === options.nodeAlign) ?? 'auto',
      area: chartArea,
      borderWidth: options.borderWidth ?? 0,
      gaps,
      insets: this._measureLabelInsets(plan, orientation),
      minSizes,
      nodeWidth: options.nodeWidth ?? 10,
      orientation,
      paddingMode: options.nodePaddingMode === 'even' ? 'even' : 'auto', // NOSONAR the deprecated option is read until it is removed in 1.0
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
    const text = vertical ? lines.length * font.lineHeight : _longestText(ctx, font.string, lines)
    const padding = style.padding * (style.backgroundColor === undefined ? 1 : 2)
    return text + padding + (vertical ? 0 : borderWidth)
  }

  override updateElements(elems: Flow[], start: number, count: number, mode: UpdateMode) {
    const geometry = this._geometry
    if (!geometry) return

    const firstOpts = this.resolveDataElementOptions(start, mode)
    const sharedOptions = this.getSharedOptions(firstOpts)
    const parsedLinks = this._plan?.links ?? []
    const direct = this._isDirect(mode)

    for (let i = start; i < start + count; i++) {
      const link = parsedLinks[i]
      if (!link) continue
      if (direct) endTweens(elems[i])
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

  /**
   * A label is drawn at the place its node is drawn at now; the side of an
   * automatically positioned one is that of the final place, so that it does
   * not flip while the node crosses the middle of the chart.
   */
  private _drawLabels(elements: NodeElement[]) {
    const ctx = this.chart.ctx
    const options = this.options
    const labels = options.labels
    const { borderWidth = 1, orientation = 'horizontal' } = options
    const defaultFont = options.font ?? this.chart.options.font ?? Chart.defaults.font
    const rects = this._geometry?.nodes

    if (!rects) return

    ctx.save()
    const chartArea = this.chart.chartArea
    for (const element of elements) {
      const { height, node, width, x, y } = element
      const target = node && rects.get(node.key)
      if (!target) continue
      const label = labels?.[node.key] ?? node.key
      const labelStyle = resolveNodeLabelStyle(options, node)
      if (labelStyle.display) {
        const font = toFont(labelStyle.font ?? defaultFont)
        drawLabel(ctx, label, {
          autoPosition: getAutoLabelPosition(target.x, target.y, chartArea, orientation),
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

  /**
   * That's where the drawing process happens: the bars of the nodes, the
   * flows over them, and the labels on top.
   */
  override draw() {
    const ctx = this.chart.ctx
    const data = (this.getMeta().data as Flow[]) ?? []
    const nodes = this._nodeElements()

    this._colorNodes(data)
    for (const node of nodes) {
      node.draw(ctx)
    }
    for (const flow of data) {
      flow.draw(ctx)
    }
    this._drawLabels(nodes)
  }

  /** Writes the colour of every node from its flows, the hovered ones last. */
  private _colorNodes(data: Flow[]) {
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
  }
}
