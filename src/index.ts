import { Chart } from 'chart.js'

import Sankey from './controller.js'
import Flow from './flow.js'
import NodeElement from './node.js'

Chart.register(Sankey, Flow, NodeElement)

export type {
  FlowConfig,
  FlowOptions,
  FlowProps,
  NodeOptions,
  NodeProps,
  Route,
  SankeyControllerDatasetBackFlowsOptions,
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyControllerDatasetNodeLabelsOptions,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyLabelPosition,
  SankeyNode,
  SankeyNodeGap,
  SankeyNodeLabelOption,
  SankeyNodeLabelPosition,
  SankeyNodeOption,
  SankeyNodeScriptableContext,
  SankeyOrientation,
  SankeyParsedData,
  SankeyParsingOptions,
  SankeyScriptableContext,
  UW,
} from './types.js'

export { Flow, NodeElement, Sankey as SankeyController }
