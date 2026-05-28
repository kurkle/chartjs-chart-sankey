import { Chart } from 'chart.js'

import Sankey from './controller.js'
import Flow from './flow.js'

Chart.register(Sankey, Flow)

export type {
  FlowConfig,
  FlowOptions,
  FlowProps,
} from './types.js'

export { Flow, Sankey as SankeyController }
