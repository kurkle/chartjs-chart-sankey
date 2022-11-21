import {
  Chart,
  ChartComponent,
  CartesianScaleTypeRegistry,
  DatasetController,
  Element,
  FontSpec,
  ScriptableContext,
  VisualElement
} from 'chart.js';

type AnyObject = Record<string, unknown>;

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
    column?: Record<string, number>
    /* Map<node.key, label> */
    labels?: Record<string, string>

    size?: 'min' | 'max'    /* defaults to max */
    borderWidth?: number    /* defaults to 1 */
    nodeWidth?: number      /* defaults to 10 */
    color?: string          /* defaults to 'black' */
    borderColor?: string    /* defaults to 'black' */
    font?: FontSpec         /* defaults to chart.options.font */
    padding?: number        /* defaults to font.lineHeight / 2 */
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
    /* true if x is defined by SankeyControllerDatasetOptions.column map  */
    column?: boolean
    /* priority extracted from the SankeyControllerDatasetOptions.priority map */
    priority?: number
    y?: number
    x?: number
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
      metaExtensions: AnyObject
      /* TODO: define sankey chart options */
      chartOptions: AnyObject;
      scales: keyof CartesianScaleTypeRegistry;
    };
  }
}

export interface FlowOptions {
  colorMode: 'gradient' | 'from' | 'to';
  colorFrom: string
  colorTo: string
}

export interface FlowConfig {
  x: number;
  y: number;
  x2: number;
  y2: number;
  height: number;
  options: FlowOptions
}

export type SankeyController = DatasetController
export const SankeyController: ChartComponent & {
  prototype: SankeyController;
  new(chart: Chart, datasetIndex: number): SankeyController;
};

export interface Flow<
  T extends FlowConfig = FlowConfig,
  O extends FlowOptions = FlowOptions
> extends Element<T, O>, VisualElement {}

export const Flow: ChartComponent & {
  prototype: Flow;
  new(cfg: FlowConfig): Flow;
};
