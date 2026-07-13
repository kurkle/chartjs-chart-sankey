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

export type SankeyNodeLabelOption<T> = T | Record<string, T> | ((node: SankeyNode) => T | undefined)

export interface SankeyControllerDatasetNodeLabelsOptions {
  backgroundColor?: SankeyNodeLabelOption<Color>
  borderRadius?: number
  color?: SankeyNodeLabelOption<Color>
  display?: SankeyNodeLabelOption<boolean>
  font?: Partial<FontSpec>
  padding?: number
  position?: SankeyNodeLabelOption<SankeyLabelPosition>
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
  hoverLinkColor?: ScriptableAndArray<Color, SankeyScriptableContext>
  labels?: Record<string, string>
  linkColor?: ScriptableAndArray<Color, SankeyScriptableContext>
  modeX?: 'edge' | 'even'
  nodeLabels?: SankeyControllerDatasetNodeLabelsOptions
  nodePadding?: number
  nodeWidth?: number
  orientation?: SankeyOrientation
  padding?: number
  parsing: SankeyParsingOptions
  priority?: Record<string, number>
  size?: 'min' | 'max'
}

export interface FromToElement {
  addY: number
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
  y?: number
  x?: number
  color?: Color
  _visited?: number
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

export interface FlowProps {
  flow: number
  x: number
  y: number
  x2: number
  y2: number
  height: number
  width: number
}

export interface FlowOptions {
  alpha: number
  colorMode: 'gradient' | 'from' | 'to'
  colorFrom: Color
  colorTo: Color
  hoverColorFrom: Color
  hoverColorTo: Color
  linkColor: Color | null
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
  from?: SankeyNode
  to?: SankeyNode
  options: FlowOptions
}
