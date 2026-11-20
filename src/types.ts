import type {
  CartesianScaleTypeRegistry,
  Color,
  ControllerDatasetOptions,
  CoreChartOptions,
  FontSpec,
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

export interface SankeyControllerDatasetOptions extends Omit<ControllerDatasetOptions, 'parsing'> {
  alpha?: number
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
  nodeLabels?: SankeyControllerDatasetNodeLabelsOptions
  nodeMinSize?: SankeyNodeOption<number>
  nodePadding?: SankeyNodeOption<number | SankeyNodeGap>
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
