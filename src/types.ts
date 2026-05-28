import type {
  CartesianScaleTypeRegistry,
  Color,
  FontSpec,
  Scriptable,
  ScriptableContext,
} from 'chart.js'

export type AnyObject = Record<string, unknown>

declare module 'chart.js' {
  interface SankeyDataPoint {
    from: string
    to: string
    flow: number
  }

  interface SankeyControllerDatasetOptions {
    label: string
    data: Array<SankeyDataPoint>
    colorFrom: (data: ScriptableContext<'sankey'>) => string
    colorTo: (data: ScriptableContext<'sankey'>) => string
    colorMode: 'gradient' | 'from' | 'to'
    hoverColorFrom?: Scriptable<string, ScriptableContext<'sankey'>>
    hoverColorTo?: Scriptable<string, ScriptableContext<'sankey'>>
    priority?: Record<string, number>
    column?: Record<string, number>
    labels?: Record<string, string>
    modeX?: 'edge' | 'even'
    size?: 'min' | 'max'
    borderWidth?: number
    nodeWidth?: number
    nodePadding?: number
    color?: string
    borderColor?: string
    font?: FontSpec
    padding?: number
    parsing: { from: string; to: string; flow: string }
  }

  type FromToElement = {
    addY: number
    flow: number
    key: string
    node: SankeyNode
    index: number
  }

  type SankeyNode = {
    key: string
    in: number
    out: number
    size: number
    from: Array<FromToElement>
    to: Array<FromToElement>
    column?: boolean
    priority?: number
    y?: number
    x?: number
    color?: Color
    _visited?: number
  }

  interface SankeyParsedData {
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

  interface ChartTypeRegistry {
    sankey: {
      datasetOptions: SankeyControllerDatasetOptions
      defaultDataPoint: SankeyDataPoint
      parsedDataType: SankeyParsedData
      metaExtensions: AnyObject
      chartOptions: FlowOptions
      scales: keyof CartesianScaleTypeRegistry
    }
  }
}

export interface FlowProps {
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
  colorFrom: 'string'
  colorTo: Color
  hoverColorFrom: Color
  hoverColorTo: Color
}

export interface FlowConfig {
  x: number
  y: number
  x2: number
  y2: number
  height: number
  options: FlowOptions
}
