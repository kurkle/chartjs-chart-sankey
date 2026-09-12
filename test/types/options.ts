import type { ChartConfiguration, ChartDataset, ChartTypeRegistry } from 'chart.js'
import type {
  SankeyControllerDatasetFlowLabelsOptions,
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
} from 'chartjs-chart-sankey'

import { Chart } from 'chart.js'
import { Flow, SankeyController } from 'chartjs-chart-sankey'

Chart.register(SankeyController, Flow)

const colors2 = [
  '#fff5eb',
  '#fee6ce',
  '#fdd0a2',
  '#fdae6b',
  '#fd8d3c',
  '#f16913',
  '#d94801',
  '#a63603',
  '#7f2704',
]
const assigned: Record<string, string> = {}

function getColor(name: string): string {
  if (!assigned[name]) {
    assigned[name] = colors2[Object.keys(assigned).length % colors2.length]
  }
  return assigned[name]
}

const config: ChartConfiguration<'sankey', SankeyDataPoint[]> = {
  data: {
    datasets: [
      {
        colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
        colorMode: 'gradient', // or 'from' or 'to'
        colorTo: ['#f00', '#0f0', '#00f'],
        data: [
          { flow: 10, from: 'a', to: 'b' },
          { flow: 5, from: 'a', to: 'c' },
          { flow: 10, from: 'b', to: 'c' },
        ],
        flowColor: (context) => (context.raw.flow > 5 ? '#999' : '#ccc'),
        flowLabels: {
          backgroundColor: (context) => (context.raw.flow > 5 ? 'white' : 'transparent'),
          color: 'black',
          display: (context) => context.raw.flow > 0,
          font: { size: 10 },
          padding: 3,
          position: 'center',
        },
        label: 'My sankey',
        /* optional labels */
        labels: {
          a: 'Label A',
          b: 'Label B',
          c: 'Label C',
        },
        nodeLabels: {
          backgroundColor: { a: '#333', b: '#666' },
          borderRadius: 3,
          color: (node) => (node.key === 'a' ? 'white' : 'black'),
          display: (node) => node.size > 0,
          font: { size: 11, weight: 'normal' },
          padding: 4,
          position: (node) => (node.key === 'a' ? 'right' : 'left'),
        },
        nodeMinSize: 6,
        nodePadding: (node) => (node.key === 'a' ? { after: 20, before: 4 } : 10),
        orientation: 'vertical',
      },
    ],
  },
  type: 'sankey',
}

const _chart = new Chart('test', config)

const orientation: SankeyOrientation = 'vertical'

// @ts-expect-error orientations other than horizontal and vertical are not supported
const invalidOrientation: SankeyOrientation = 'diagonal'

type MixedDataset = ChartDataset<keyof ChartTypeRegistry>

function getDatasetBackgroundColor(dataset: MixedDataset) {
  return dataset.backgroundColor
}

const _backgroundColor = getDatasetBackgroundColor(config.data.datasets[0])

type _PublicTypes = [
  SankeyControllerDatasetOptions,
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyLabelPosition,
  SankeyNodeGap,
  SankeyNodeLabelOption<number>,
  SankeyNodeLabelPosition,
  SankeyNodeOption<number>,
  SankeyOrientation,
  SankeyParsingOptions,
  SankeyParsedData,
  SankeyScriptableContext,
  typeof orientation,
  typeof invalidOrientation,
]

// nodePadding accepts a plain number, a Record of node keys, or a function
// receiving a SankeyNode -- each resolving to either a number or a
// before/after gap object.
const nodePaddingNumber: SankeyControllerDatasetOptions['nodePadding'] = 10
const nodePaddingGap: SankeyControllerDatasetOptions['nodePadding'] = { after: 20, before: 4 }
const nodePaddingRecord: SankeyControllerDatasetOptions['nodePadding'] = {
  Coal: { after: 28 },
  Solar: 4,
}
const nodePaddingFunction: SankeyControllerDatasetOptions['nodePadding'] = (node) =>
  node.key === 'Coal' ? { after: 28 } : 4

type _NodePaddingForms = [
  typeof nodePaddingNumber,
  typeof nodePaddingGap,
  typeof nodePaddingRecord,
  typeof nodePaddingFunction,
]

// nodePaddingMode is a dataset-level enum -- 'auto' (default) or 'even' --
// not a per-node option, so it never goes through SankeyNodeOption.
const nodePaddingModeAuto: SankeyControllerDatasetOptions['nodePaddingMode'] = 'auto'
const nodePaddingModeEven: SankeyControllerDatasetOptions['nodePaddingMode'] = 'even'

// @ts-expect-error nodePaddingMode only accepts 'auto' or 'even'
const invalidNodePaddingMode: SankeyControllerDatasetOptions['nodePaddingMode'] = 'static'

type _NodePaddingModeForms = [
  typeof nodePaddingModeAuto,
  typeof nodePaddingModeEven,
  typeof invalidNodePaddingMode,
]

// nodeMinSize accepts a plain number, a Record of node keys, or a function
// receiving a SankeyNode -- same SankeyNodeOption<number> shape as
// nodeLabels.padding, but node-scoped instead of Chart.js-scriptable.
const nodeMinSizeNumber: SankeyControllerDatasetOptions['nodeMinSize'] = 6
const nodeMinSizeRecord: SankeyControllerDatasetOptions['nodeMinSize'] = {
  Coal: 6,
  Solar: 4,
}
const nodeMinSizeFunction: SankeyControllerDatasetOptions['nodeMinSize'] = (node) =>
  node.key === 'Coal' ? 6 : 4

type _NodeMinSizeForms = [
  typeof nodeMinSizeNumber,
  typeof nodeMinSizeRecord,
  typeof nodeMinSizeFunction,
]
