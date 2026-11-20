import { Chart } from 'chart.js'

import Sankey from './controller.js'
import Flow from './flow.js'

Chart.register(Sankey, Flow)

export type {
  BandRoute,
  FlowConfig,
  FlowOptions,
  FlowProps,
  LoopRoute,
  LoopVertex,
  Route,
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyControllerDatasetNodeLabelsOptions,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyLabelPosition,
  SankeyNodeGap,
  SankeyNodeLabelOption,
  SankeyNodeLabelPosition,
  SankeyNodeOption,
  SankeyOrientation,
  SankeyParsedData,
  SankeyParsingOptions,
  SankeyScriptableContext,
  UW,
} from './types.js'

export { Flow, Sankey as SankeyController }
