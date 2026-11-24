import type {
  CartesianScaleTypeRegistry,
  Color,
  ControllerDatasetOptions,
  CoreChartOptions,
  FontSpec,
  InteractionModeFunction,
  Scriptable,
  ScriptableAndArray,
  ScriptableContext,
} from 'chart.js'

export type AnyObject = Record<string, unknown>

export interface SankeyDataPoint {
  from: string
  to: string
  flow: number
}

export type SankeyScriptableContext = ScriptableContext<'sankey'> & {
  raw: SankeyDataPoint
}

export type SankeyLabelPosition = 'auto' | 'bottom' | 'center' | 'left' | 'right' | 'top'
export type SankeyNodeLabelPosition = SankeyLabelPosition
export type SankeyOrientation = 'horizontal' | 'vertical'

export type SankeyNodeOption<T> = T | Record<string, T> | ((node: SankeyNode) => T | undefined)
/** @deprecated use SankeyNodeOption */
export type SankeyNodeLabelOption<T> = SankeyNodeOption<T>

export interface SankeyNodeGap {
  after?: number
  before?: number
}

export interface SankeyControllerDatasetNodeLabelsOptions {
  backgroundColor?: SankeyNodeOption<Color>
  borderRadius?: number
  color?: SankeyNodeOption<Color>
  display?: SankeyNodeOption<boolean>
  font?: Partial<FontSpec>
  padding?: number
  position?: SankeyNodeOption<SankeyLabelPosition>
}

export interface SankeyControllerDatasetFlowLabelsOptions {
  backgroundColor?: Scriptable<Color, SankeyScriptableContext>
  borderRadius?: Scriptable<number, SankeyScriptableContext>
  color?: Scriptable<Color, SankeyScriptableContext>
  display?: Scriptable<boolean, SankeyScriptableContext>
  font?: Scriptable<Partial<FontSpec>, SankeyScriptableContext>
  padding?: Scriptable<number, SankeyScriptableContext>
  position?: Scriptable<SankeyLabelPosition, SankeyScriptableContext>
}

export interface SankeyParsingOptions {
  from: string
  to: string
  flow: string
}

/** How the back flows are drawn. */
export interface SankeyControllerDatasetBackFlowsOptions {
  /**
   * The back flows that share a lane: `'pair'` (the default) those between the
   * same two nodes, `'target'` all that return to one node, `'source'` all that
   * leave one node, `false` a lane for each back flow.
   */
  bundle?: false | 'pair' | 'target' | 'source'
  /**
   * The side of the cross axis the lanes run along: `'end'` (the default) after
   * the content (bottom of a horizontal chart, right of a vertical one),
   * `'start'` before it, `'auto'` the side nearer to the ends of each lane.
   */
  side?: 'end' | 'start' | 'auto'
}

export interface SankeyControllerDatasetOptions extends Omit<ControllerDatasetOptions, 'parsing'> {
  alpha?: number
  backFlows?: SankeyControllerDatasetBackFlowsOptions
  backgroundColor?: never
  borderColor?: Color
  borderWidth?: number
  color?: Color
  colorFrom?: ScriptableAndArray<Color, SankeyScriptableContext>
  colorMode?: 'gradient' | 'from' | 'to'
  colorTo?: ScriptableAndArray<Color, SankeyScriptableContext>
  column?: Record<string, number>
  font?: Partial<FontSpec>
  flowLabels?: SankeyControllerDatasetFlowLabelsOptions
  hoverColorFrom?: ScriptableAndArray<Color, SankeyScriptableContext>
  hoverColorTo?: ScriptableAndArray<Color, SankeyScriptableContext>
  hoverFlowColor?: ScriptableAndArray<Color, SankeyScriptableContext>
  labels?: Record<string, string>
  flowColor?: ScriptableAndArray<Color, SankeyScriptableContext>
  modeX?: 'edge' | 'even'
  /**
   * Where the nodes of a column sit on the cross axis (top to bottom in a
   * horizontal chart, left to right in a vertical one); which column a node is
   * in is up to `column` and `modeX`.
   *
   * - `'auto'` (the default): every node is moved towards where its flows
   *   meet, so a gap can grow wider than `nodePadding`.
   * - `'start'`: every column is packed at the start (top, or left) with
   *   exactly the requested gaps; the nodes are not moved towards their flows.
   * - `'end'`: the same, packed at the end (bottom, or right).
   * - `'edges'`: the first and the last node (or the flow that skips the
   *   column) of every column touch the two edges, the ones between them are
   *   placed as with `'auto'`, and a node alone in its column goes to the edge
   *   nearer to its flows.
   *
   * Any other value is drawn as `'auto'`. With every value but `'auto'` with
   * `nodePaddingMode: 'even'`, a flow that skips columns is held level across
   * them, so a column it passes can sit off its edge or have one gap wider than
   * requested.
   */
  nodeAlign?: 'auto' | 'start' | 'end' | 'edges'
  nodeLabels?: SankeyControllerDatasetNodeLabelsOptions
  nodeMinSize?: SankeyNodeOption<number>
  nodePadding?: SankeyNodeOption<number | SankeyNodeGap>
  /**
   * `'even'` moves every column as one block with exactly the requested gaps,
   * and the flows that skip columns are then not held level. It has an effect
   * only with `nodeAlign: 'auto'`.
   *
   * @deprecated Keeps working until 1.0, where it is removed without a
   * replacement. `nodeAlign: 'start'` and `'end'` give exactly the requested
   * gaps, except in a column that a flow skipping columns runs level across.
   */
  nodePaddingMode?: 'auto' | 'even'
  nodeWidth?: number
  orientation?: SankeyOrientation
  padding?: number
  parsing: SankeyParsingOptions
  priority?: Record<string, number>
  size?: 'min' | 'max'
}

export interface FromToElement {
  flow: number
  key: string
  node: SankeyNode
  index: number
}

export interface SankeyNode {
  key: string
  in: number
  out: number
  size: number
  from: FromToElement[]
  to: FromToElement[]
  column?: boolean
  priority?: number
  x?: number
  color?: Color
}

/** The props of the element of a node: its bar, and the node of the plan. */
export interface NodeProps {
  x: number
  y: number
  width: number
  height: number
  node?: SankeyNode
}

export interface NodeOptions {
  borderColor?: Color
  borderWidth: number
}

export interface SankeyParsedData {
  x: number
  y: number
  _custom: {
    from: SankeyNode
    to: SankeyNode
    x: number
    y: number
    height: number
    flow: number
  }
}

declare module 'chart.js' {
  interface ChartTypeRegistry {
    sankey: {
      datasetOptions: SankeyControllerDatasetOptions
      defaultDataPoint: SankeyDataPoint
      parsedDataType: SankeyParsedData
      metaExtensions: AnyObject
      chartOptions: CoreChartOptions<'sankey'>
      scales: keyof CartesianScaleTypeRegistry
    }
  }

  /** `'sankey'`: of the flows hit at the mouse, the one whose band is nearest (the default of a sankey chart). */
  interface InteractionModeMap {
    sankey: InteractionModeFunction
  }
}

// -- routes ------------------------------------------------------------------

/** A point in the frame of the layout: `u` runs along the columns and `w` across them. */
export interface UW {
  u: number
  w: number
}

/**
 * The finished route of a flow in (u, w). Without a `radius` it is a forward
 * flow: a band of thickness `t` below the line through `points`, which
 * alternate between where the band leaves a slot and where it enters the next
 * one. With a `radius` it is a back flow: `points` are the corners of the
 * center line (source edge, turn, lane, turn, target edge) of a band of
 * thickness `t`, and `radius` rounds the turns.
 */
export interface Route {
  points: UW[]
  t: number
  radius?: number
  /** Radius of the turns at the target, when they go round other flows of a shared lane */
  radius2?: number
}

export interface FlowProps {
  flow: number
  x: number
  y: number
  x2: number
  y2: number
  height: number
  width: number
  route?: Route
}

export interface FlowOptions {
  alpha: number
  colorMode: 'gradient' | 'from' | 'to'
  colorFrom: Color
  colorTo: Color
  hoverColorFrom: Color
  hoverColorTo: Color
  flowColor: Color | null
  orientation: SankeyOrientation
  flowLabels: {
    backgroundColor?: Color
    borderRadius: number
    color: Color
    display: boolean
    font?: Partial<FontSpec>
    padding: number
    position: SankeyLabelPosition
  }
}

export interface FlowConfig {
  flow?: number
  x: number
  y: number
  x2: number
  y2: number
  height: number
  width?: number
  progress?: number
  route?: Route
  back?: boolean
  from?: SankeyNode
  to?: SankeyNode
  options: FlowOptions
}
