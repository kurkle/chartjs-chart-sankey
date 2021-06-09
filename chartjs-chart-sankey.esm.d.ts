import {Chart, ChartComponent, DatasetController} from "chart.js";

declare module 'chart.js' {
  interface SankeyDataElement {
    from: string;
    to: string;
    flow: number;
  }

  interface SankeyDataSetOptions {
    label: string;
    data: Array<SankeyDataElement>;
    colorFrom: (data: SankeyData) => string;
    colorTo: (data: SankeyData) => string;
    colorMode: 'gradient' | 'from' | 'to';
    priority: any;
    borderWidth: any;
    nodeWidth: any;
    borderColor: any;
    color?: string;
    labels?: Array<string>;
  }

  interface SankeyData {
    dataset: SankeyDataSetOptions;
    dataIndex: number;
  }

  interface ChartTypeRegistry {
    sankey: {
      datasetOptions: SankeyDataSetOptions;
      defaultDataPoint: any;
      parsedDataType: any;
      chartOptions: any;
      scales: any;
    };
  }
}
type FlowConfig = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  height: any;
};
export type SankeyController = DatasetController
export const SankeyController: ChartComponent & {
  prototype: SankeyController;
  new(chart: Chart, datasetIndex: number): SankeyController;
};

export type Flow = DatasetController
export const Flow: ChartComponent & {
  prototype: Flow;
  new(cfg: FlowConfig): Flow;
};
