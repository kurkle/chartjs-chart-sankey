'use strict';

import {DatasetController} from 'chart.js';
import {valueOrDefault, toFont, isNullOrUndef} from 'chart.js/helpers';
import {layout} from './layout';

/**
 * @param data {Array<SankeyDataPoint>} Array of raw data elements
 * @return {Map<string, SankeyNode>}
 */
export function buildNodesFromRawData(data) {
  const nodes = new Map();
  for (let i = 0; i < data.length; i++) {
    const {from, to, flow} = data[i];

    if (!nodes.has(from)) {
      nodes.set(from, {
        key: from,
        in: 0,
        out: flow,
        from: [],
        to: [{key: to, flow: flow}],
      });
    } else {
      const node = nodes.get(from);
      node.out += flow;
      node.to.push({key: to, flow: flow});
    }
    if (!nodes.has(to)) {
      nodes.set(to, {
        key: to,
        in: flow,
        out: 0,
        from: [{key: from, flow: flow}],
        to: [],
      });
    } else {
      const node = nodes.get(to);
      node.in += flow;
      node.from.push({key: from, flow: flow});
    }
  }

  const flowSort = (a, b) => b.flow - a.flow;

  [...nodes.values()].forEach(node => {
    node.from = node.from.sort(flowSort);
    node.from.forEach(x => {
      x.node = nodes.get(x.key);
    });

    node.to = node.to.sort(flowSort);
    node.to.forEach(x => {
      x.node = nodes.get(x.key);
    });
  });

  return nodes;
}

/**
 * @param arr {Array<FromToElement>}
 * @param key {string}
 * @return {number}
 */
function getAddY(arr, key) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].key === key) {
      return arr[i].addY;
    }
  }
  return 0;
}

/**
 * @param size {any}
 * @return {'min' | 'max'}
 */
function validateSizeValue(size) {
  if (!size || ['min', 'max'].indexOf(size) === -1) {
    return 'max';
  }
  return size;
}

export default class SankeyController extends DatasetController {
  /**
   * @param meta {ChartMeta<Flow, Element>}
   * @param data {Array<SankeyDataPoint>} Array of original data elements
   * @param start {number}
   * @param count {number}
   * @return {Array<SankeyParsedData>}
   */
  parseObjectData(meta, data, start, count) {
    // https://github.com/chartjs/Chart.js/pull/8379
    if (count === 0) {
      return [];
    }
    const me = this;
    const {xScale, yScale} = meta;
    const parsed = []; /* Array<SankeyParsedData> */
    const nodes = me._nodes = buildNodesFromRawData(data);
    /* getDataset() => SankeyControllerDatasetOptions */
    const {priority, size} = me.getDataset();
    if (priority) {
      for (const node of nodes.values()) {
        if (node.key in priority) {
          node.priority = priority[node.key];
        }
      }
    }

    const {maxX, maxY} = layout(nodes, data, !!priority, validateSizeValue(size));

    me._maxX = maxX;
    me._maxY = maxY;

    /* loop over raw data elements {SankeyDataPoint} */
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const dataPoint = data[i]; /* {SankeyDataPoint} */
      const from = nodes.get(dataPoint.from); /* from {SankeyNode} */
      const to = nodes.get(dataPoint.to); /* to {SankeyNode} */
      const fromY = from.y + getAddY(from.to, dataPoint.to);
      const toY = to.y + getAddY(to.from, dataPoint.from);
      parsed.push({
        x: xScale.parse(from.x, i),
        y: yScale.parse(fromY, i),
        _custom: {
          from,
          to,
          x: xScale.parse(to.x, i),
          y: yScale.parse(toY, i),
          height: yScale.parse(dataPoint.flow, i),
        }
      });
    }
    return parsed.slice(start, start + count);
  }

  getMinMax(scale) {
    const me = this;
    return {
      min: 0,
      max: scale === this._cachedMeta.xScale ? this._maxX : me._maxY
    };
  }

  update(mode) {
    const me = this;
    const meta = me._cachedMeta;

    me.updateElements(meta.data, 0, meta.data.length, mode);
  }

  /**
   * @param elems {Array<Flow>}
   * @param start {number}
   * @param count {number}
   * @param mode {"resize" | "reset" | "none" | "hide" | "show" | "normal" | "active"}
   */
  updateElements(elems, start, count, mode) {
    const me = this;
    const {xScale, yScale} = me._cachedMeta;
    const firstOpts = me.resolveDataElementOptions(start, mode);
    const sharedOptions = me.getSharedOptions(mode, elems[start], firstOpts);
    const dataset = me.getDataset();
    const borderWidth = valueOrDefault(dataset.borderWidth, 1) / 2 + 0.5;
    const nodeWidth = valueOrDefault(dataset.nodeWidth, 10);

    for (let i = start; i < start + count; i++) {
      /* getParsed(idx: number) => SankeyParsedData */
      const parsed = me.getParsed(i);
      const custom = parsed._custom;
      const y = yScale.getPixelForValue(parsed.y);
      me.updateElement(
        elems[i],
        i,
        {
          x: xScale.getPixelForValue(parsed.x) + nodeWidth + borderWidth,
          y,
          x2: xScale.getPixelForValue(custom.x) - borderWidth,
          y2: yScale.getPixelForValue(custom.y),
          from: custom.from,
          to: custom.to,
          progress: mode === 'reset' ? 0 : 1,
          height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
          options: me.resolveDataElementOptions(i, mode)
        },
        mode);
    }

    me.updateSharedOptions(sharedOptions, mode);
  }

  _drawLabels() {
    const me = this;
    const ctx = me._ctx;
    const nodes = me._nodes || new Map();
    const dataset = me.getDataset(); /* SankeyControllerDatasetOptions */
    const size = validateSizeValue(dataset.size);
    const borderWidth = valueOrDefault(dataset.borderWidth, 1);
    const nodeWidth = valueOrDefault(dataset.nodeWidth, 10);
    const labels = dataset.labels;
    const {xScale, yScale} = me._cachedMeta;

    ctx.save();
    const chartArea = me.chart.chartArea;
    for (const node of nodes.values()) {
      const x = xScale.getPixelForValue(node.x);
      const y = yScale.getPixelForValue(node.y);

      const max = Math[size](node.in || node.out, node.out || node.in);
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
      const label = labels && labels[node.key] || node.key;
      let textX = x;
      ctx.fillStyle = dataset.color || 'black';
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

  /**
   * @param label {string}
   * @param y {number}
   * @param height {number}
   * @param ctx {CanvasRenderingContext2D}
   * @param textX {number}
   * @private
   */
  _drawLabel(label, y, height, ctx, textX) {
    const me = this;
    const font = toFont(me.options.font, me.chart.options.font);
    const lines = isNullOrUndef(label) ? [] : me.toTextLines(label);
    const linesLength = lines.length;
    const middle = y + height / 2;
    const padding = 7.5;
    const textHeight = font.lineHeight;

    ctx.font = font.string;

    if (linesLength > 1) {
      const top = middle - (textHeight * linesLength / 2) + padding;
      for (let i = 0; i < linesLength; i++) {
        ctx.fillText(lines[i], textX, top + (i * textHeight));
      }
    } else {
      ctx.fillText(label, textX, middle);
    }
  }

  /**
   * @param inputs {string | Array<string>}
   * @return {Array<string>}
   * @todo move this in Chart.helpers.toTextLines
   */
  toTextLines(inputs) {
    let lines = [];
    let input;

    inputs = [].concat(inputs);
    while (inputs.length) {
      input = inputs.pop();
      if (typeof input === 'string') {
        lines.unshift.apply(lines, input.split('\n'));
      } else if (Array.isArray(input)) {
        inputs.push.apply(inputs, input);
      } else if (!isNullOrUndef(inputs)) {
        lines.unshift('' + input);
      }
    }

    return lines;
  }

  _drawNodes() {
    const me = this;
    const ctx = me._ctx;
    const nodes = me._nodes || new Map();
    const dataset = me.getDataset();  /* SankeyControllerDatasetOptions */
    const size = validateSizeValue(dataset.size);
    const {xScale, yScale} = me._cachedMeta;
    const borderWidth = valueOrDefault(dataset.borderWidth, 1);
    const nodeWidth = valueOrDefault(dataset.nodeWidth, 10);

    ctx.save();
    ctx.strokeStyle = dataset.borderColor || 'black';
    ctx.lineWidth = borderWidth;

    for (const node of nodes.values()) {
      ctx.fillStyle = node.color;
      const x = xScale.getPixelForValue(node.x);
      const y = yScale.getPixelForValue(node.y);

      const max = Math[size](node.in || node.out, node.out || node.in);
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
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
    const me = this;
    const ctx = me._ctx;
    const data = me.getMeta().data || []; /* Array<Flow> */

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i]; /* Flow at index i */
      flow.from.color = flow.options.colorFrom;
      flow.to.color = flow.options.colorTo;
    }

    /* draw SankeyNodes on the canvas */
    me._drawNodes();

    /* draw Flow elements on the canvas */
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx);
    }

    /* draw labels (for SankeyNodes) on the canvas */
    me._drawLabels();
  }
}

SankeyController.id = 'sankey';
SankeyController.defaults = {
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
};
SankeyController.overrides = {
  interaction: {
    mode: 'nearest',
    intersect: true
  },
  datasets: {
    color: () => '#efefef',
    clip: false,
    parsing: true
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
};
