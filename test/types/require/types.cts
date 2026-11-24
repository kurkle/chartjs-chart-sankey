// A CommonJS file: the package resolves through its `require` condition, so
// this checks the types of dist/index.d.cts, which options.ts (an ES module)
// does not reach.
import type {
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
} from 'chartjs-chart-sankey'

import sankey = require('chartjs-chart-sankey')

const { Flow, NodeElement, SankeyController } = sankey
const element: InstanceType<typeof NodeElement> = new NodeElement()
const _inRange: boolean = element.inRange(0, 0, true)

declare const nodeContext: SankeyNodeScriptableContext
const node: SankeyNode = nodeContext.node
const type: 'node' = nodeContext.type

export type PublicTypes = [
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
  SankeyNodeGap,
  SankeyNodeLabelOption<number>,
  SankeyNodeLabelPosition,
  SankeyNodeOption<number>,
  SankeyOrientation,
  SankeyParsedData,
  SankeyParsingOptions,
  SankeyScriptableContext,
  UW,
  typeof Flow,
  typeof NodeElement,
  typeof SankeyController,
  typeof node,
  typeof type,
]
