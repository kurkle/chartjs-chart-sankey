import { Chart } from 'chart.js'

import Sankey from './controller.js'
import Flow from './flow.js'

Chart.register(Sankey, Flow)

export type {
  FlowConfig,
  FlowOptions,
  FlowProps,
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyControllerDatasetNodeLabelsOptions,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyLabelPosition,
  SankeyNodeLabelOption,
  SankeyNodeLabelPosition,
  SankeyParsedData,
  SankeyParsingOptions,
  SankeyScriptableContext,
} from './types.js'

export { Flow, Sankey as SankeyController }
