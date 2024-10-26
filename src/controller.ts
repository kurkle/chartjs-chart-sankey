import {ChartMeta, DatasetController, FromToElement, SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode, SankeyParsedData} from 'chart.js';
import {valueOrDefault, toFont} from 'chart.js/helpers';
import {toTextLines, validateSizeValue} from './helpers.ts';
import {layout} from './layout.ts';
import Flow from './flow.ts';
import { AnyObject } from '../types/index.esm';

const flowSort = (a: FromToElement, b: FromToElement) => {
  // In case the flows are equal, keep original order
  if (b.flow === a.flow) return a.index - b.index

  return b.flow - a.flow
}

export function buildNodesFromData(data: SankeyDataPoint[]): Map<string, SankeyNode> {
  const nodes = new Map<string, SankeyNode>();
  for (let i = 0; i < data.length; i++) {
    const {from, to, flow} = data[i];

    // ignore zero or negative flows
    if (flow <= 0) continue;

    const fromNode: SankeyNode = nodes.get(from) ?? {
      key: from,
      in: 0,
      out: 0,
      from: [],
      to: [],
    }

    const toNode: SankeyNode = (from === to ? fromNode : nodes.get(to)) ?? {
      key: to,
      in: 0,
      out: 0,
      from: [],
      to: [],
    }

    fromNode.out += flow
    fromNode.to.push({key: to, flow: flow, index: i, node: toNode, addY: 0})
    if (fromNode.to.length === 1) {
      nodes.set(from, fromNode)
    }

    toNode.in += flow
    toNode.from.push({key: from, flow: flow, index: i, node: fromNode, addY: 0})
    if (toNode.from.length === 1) {
      nodes.set(to, toNode)
    }
  }

  for (const node of nodes.values()) {
    node.from.sort(flowSort)
    node.to.sort(flowSort)
  }

  return nodes;
}

function getAddY(arr: FromToElement[], key: string, index: number): number {
  for (const item of arr) {
    if (item.key === key && item.index === index) {
      return item.addY;
    }
  }
  return 0;
}

export default class SankeyController extends DatasetController {
  static id = 'sankey'

  static defaults = {
    dataElementType: 'flow',
    animations: {
      numbers: {
        type: 'number',
        properties: ['x', 'y', 'x2', 'y2', 'height']
      },
      progress: {
        easing: 'linear',
        duration: (ctx) => ctx.type === 'data' ? (ctx.parsed._custom.x - ctx.parsed.x) * 200 : undefined,
        delay: (ctx) => ctx.type === 'data' ? ctx.parsed.x * 500 + ctx.dataIndex * 20 : undefined,
      },
      colors: {
        type: 'color',
        properties: ['colorFrom', 'colorTo'],
      },
    },
    color: 'black',
    borderColor: 'black',
    borderWidth: 1,
    nodeWidth: 10,
    transitions: {
      hide: {
        animations: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            to: 'transparent'
          }
        }
      },
      show: {
        animations: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            from: 'transparent'
          }
        }
      }
    }
  }

  static overrides = {
    interaction: {
      mode: 'nearest',
      intersect: true
    },
    datasets: {
      clip: false,
      parsing: { from: 'from', to: 'to', flow: 'flow' }
    },
    plugins: {
      tooltip: {
        callbacks: {
          title() {
            return '';
          },
          label(context) {
            const item = context.dataset.data[context.dataIndex];
            return item.from + ' -> ' + item.to + ': ' + item.flow;
          }
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
      },
      y: {
        type: 'linear',
        bounds: 'data',
        display: false,
        min: 0,
        reverse: true,
        offset: false,
      },
    },
    layout: {
      padding: {
        top: 3,
        left: 3,
        right: 13,
        bottom: 3,
      },
    },
  }

  options: SankeyControllerDatasetOptions
  private _nodes: Map<string, SankeyNode>
  private _maxX: number
  private _maxY: number

  parseObjectData(meta: ChartMeta<'sankey', Flow>, data: AnyObject[], start: number, count: number): SankeyParsedData[] {
    const {from: fromKey = 'from', to: toKey = 'to', flow: flowKey = 'flow'} = this.options.parsing;
    const sankeyData = data.map(({[fromKey]: from, [toKey]: to, [flowKey]: flow}) => ({from, to, flow} as SankeyDataPoint));
    const {xScale, yScale} = meta;
    const parsed: SankeyParsedData[] = [];
    const nodes = this._nodes = buildNodesFromData(sankeyData);
    const {column, priority, size} = this.options
    if (priority) {
      for (const node of nodes.values()) {
        if (node.key in priority) {
          node.priority = priority[node.key];
        }
      }
    }
    if (column) {
      for (const node of nodes.values()) {
        if (node.key in column) {
          node.column = true;
          node.x = column[node.key];
        }
      }
    }

    const {maxX, maxY} = layout(nodes, sankeyData, !!priority, validateSizeValue(size));

    this._maxX = maxX;
    this._maxY = maxY;

    if (!xScale || !yScale) return []

    for (let i = 0, ilen = sankeyData.length; i < ilen; ++i) {
      const dataPoint = sankeyData[i];
      const from = nodes.get(dataPoint.from);
      const to = nodes.get(dataPoint.to);
      if (!from || ! to) continue;

      const fromY: number = (from.y ?? 0) + getAddY(from.to, dataPoint.to, i);
      const toY: number = (to.y ?? 0) + getAddY(to.from, dataPoint.from, i);

      parsed.push({
        x: xScale.parse(from.x, i) as number,
        y: yScale.parse(fromY, i) as number,
        _custom: {
          from,
          to,
          x: xScale.parse(to.x, i) as number,
          y: yScale.parse(toY, i) as number,
          height: yScale.parse(dataPoint.flow, i) as number,
        }
      });
    }
    return parsed.slice(start, start + count);
  }

  getMinMax(scale) {
    return {
      min: 0,
      max: scale === this._cachedMeta.xScale ? this._maxX : this._maxY
    };
  }

  update(mode) {
    const {data} = this._cachedMeta as ChartMeta<'sankey', Flow>;

    this.updateElements(data, 0, data.length, mode);
  }

  updateElements(elems: Flow[], start: number, count: number, mode: "default" | "resize" | "reset" | "none" | "hide" | "show" | "active") {
    const {xScale, yScale} = this._cachedMeta;
    if (!xScale || !yScale) return

    const firstOpts = this.resolveDataElementOptions(start, mode);
    const sharedOptions = this.getSharedOptions(firstOpts);
    const { borderWidth, nodeWidth = 10 } = this.options;
    const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0;

    for (let i = start; i < start + count; i++) {
      const parsed = this.getParsed(i) as SankeyParsedData;
      const custom = parsed._custom;
      const y = yScale.getPixelForValue(parsed.y);
      this.updateElement(
        elems[i],
        i,
        {
          x: xScale.getPixelForValue(parsed.x) + nodeWidth + borderSpace,
          y,
          x2: xScale.getPixelForValue(custom.x) - borderSpace,
          y2: yScale.getPixelForValue(custom.y),
          from: custom.from,
          to: custom.to,
          progress: mode === 'reset' ? 0 : 1,
          height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
          options: this.resolveDataElementOptions(i, mode)
        },
        mode);
    }

    // updateSharedOptions typings are wrong in Chart.js, it accepts undefined also
    this.updateSharedOptions(sharedOptions!, mode, firstOpts);
  }

  private _drawLabels() {
    const ctx = this.chart.ctx;
    const options = this.options;
    const nodes = this._nodes || new Map();
    const size = validateSizeValue(options.size);
    const borderWidth = options.borderWidth ?? 1;
    const nodeWidth = options.nodeWidth ?? 10;
    const labels = options.labels;
    const {xScale, yScale} = this._cachedMeta;

    if (!xScale || !yScale) return;

    ctx.save();
    const chartArea = this.chart.chartArea;
    for (const node of nodes.values()) {
      // Assuming all nodes have x & y values here
      const x = xScale.getPixelForValue(node.x!);
      const y = yScale.getPixelForValue(node.y!);

      const max = Math[size](node.in || node.out, node.out || node.in);
      const height = Math.abs(yScale.getPixelForValue(node.y! + max) - y);
      const label = labels && labels[node.key] || node.key;
      let textX = x;
      ctx.fillStyle = options.color ?? 'black';
      ctx.textBaseline = 'middle';
      if (x < chartArea.width / 2) {
        ctx.textAlign = 'left';
        textX += nodeWidth + borderWidth + 4;
      } else {
        ctx.textAlign = 'right';
        textX -= borderWidth + 4;
      }
      this._drawLabel(label, y, height, ctx, textX);
    }
    ctx.restore();
  }

  private _drawLabel(label: string, y: number, height: number, ctx: CanvasRenderingContext2D, textX: number) {
    // Probably another typing issue in Chart.js with toFont
    const font = toFont(this.options.font!, this.chart.options.font);
    const lines = toTextLines(label);
    const lineCount = lines.length;
    const middle = y + height / 2;
    const textHeight = font.lineHeight;
    const padding = valueOrDefault(this.options.padding, textHeight / 2);

    ctx.font = font.string;

    if (lineCount > 1) {
      const top = middle - (textHeight * lineCount / 2) + padding;
      for (let i = 0; i < lineCount; i++) {
        ctx.fillText(lines[i], textX, top + (i * textHeight));
      }
    } else {
      ctx.fillText(label, textX, middle);
    }
  }

  private _drawNodes() {
    const ctx = this.chart.ctx;
    const nodes = this._nodes || new Map();
    const { borderColor, borderWidth = 0, nodeWidth = 10, size } = this.options;
    const sizeMethod = validateSizeValue(size);
    const {xScale, yScale} = this._cachedMeta;

    ctx.save();
    if (borderColor && borderWidth) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
    }

    for (const node of nodes.values()) {
      ctx.fillStyle = node.color ?? 'black';
      const x = xScale!.getPixelForValue(node.x!);
      const y = yScale!.getPixelForValue(node.y!);

      const max = Math[sizeMethod](node.in || node.out, node.out || node.in);
      const height = Math.abs(yScale!.getPixelForValue(node.y! + max) - y);
      if (borderWidth) {
        ctx.strokeRect(x, y, nodeWidth, height);
      }
      ctx.fillRect(x, y, nodeWidth, height);
    }
    ctx.restore();
  }

  /**
   * That's where the drawing process happens
   */
  draw() {
    const ctx = this.chart.ctx;
    const data = this.getMeta().data as Flow[] ?? [];

    // Set node colors
    const active: Flow[] = [];
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i]; /* Flow at index i */
      flow.from.color = flow.options.colorFrom;
      flow.to.color = flow.options.colorTo;
      if (flow.active) {
        active.push(flow);
      }
    }

    // Make sure nodes connected to hovered flows are using hover colors.
    for (const flow of active) {
      flow.from.color = flow.options.colorFrom;
      flow.to.color = flow.options.colorTo;
    }

    this._drawNodes();

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx);
    }

    this._drawLabels();
  }
}
