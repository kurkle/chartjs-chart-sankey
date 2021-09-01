import {
  Chart,
  ChartComponent,
  DatasetController,
  Element
} from 'chart.js';

declare module 'chart.js' {

  /* raw data element */
  interface SankeyDataPoint {
    from: string;
    to: string;
    flow: number;
  }

  /* dataset configuration */
  interface SankeyControllerDatasetOptions {
    label: string;
    data: Array<SankeyDataPoint>;
    colorFrom: (data: ScriptableContext<'sankey'>) => string;
    colorTo: (data: ScriptableContext<'sankey'>) => string;
    colorMode: 'gradient' | 'from' | 'to';
    /* Map<node.key, priority_value> */
    priority?: Record<string, number>
    /* Map<node.key, label> */
    labels?: Record<string, string>

    borderWidth?: number    /* defaults to 1 */
    nodeWidth?: number      /* defaults to 10 */
    color?: string          /* defaults to 'black' */
    borderColor?: string    /* defaults to 'black' */
  }

  type FromToElement = {
    addY: number
    flow: number
    key: string
    node: SankeyNode
  }

  type SankeyNode = {
    /* unique key of a node */
    key: string
    /* number of => in-connections */
    in: number
    /* number of out => connections */
    out: number
    from: Array<FromToElement>
    to: Array<FromToElement>
    /* priority extracted from the SankeyControllerDatasetOptions.priority map */
    priority?: string
    y?: number
  }

  interface SankeyParsedData {
    x: number
    y: number
    _custom: {
      from: SankeyNode,
      to: SankeyNode
      x: number
      y: number
      height: number,
    }
  }

  interface ChartTypeRegistry {
    sankey: {
      datasetOptions: SankeyControllerDatasetOptions;
      defaultDataPoint: SankeyDataPoint;
      parsedDataType: SankeyParsedData;
      metaExtensions:{}
      /* TODO: define sankey chart options */
      chartOptions: any;
      scales: keyof CartesianScaleTypeRegistry;
    };
  }
}

type FlowOptions = {
  colorMode: 'gradient' | 'from' | 'to';
  colorFrom: string
  colorTo: string
}

type FlowConfig = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  height: number;
  options: FlowOptions
};

export type SankeyController = DatasetController
export const SankeyController: ChartComponent & {
  prototype: SankeyController;
  new(chart: Chart, datasetIndex: number): SankeyController;
};

export type Flow = Element<FlowConfig, FlowOptions>
export const Flow: ChartComponent & {
  prototype: Flow;
  new(cfg: FlowConfig): Flow;
};
