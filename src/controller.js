'use strict';

import {DatasetController} from 'chart.js';
import {valueOrDefault, isNullOrUndef} from 'chart.js/helpers';
import {layout} from './layout';

export function buildNodesFromFlows(data) {
  const nodes = new Map();
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (!nodes.has(d.from)) {
      nodes.set(d.from, {key: d.from, in: 0, out: d.flow, from: [], to: [{key: d.to, flow: d.flow}]});
    } else {
      const node = nodes.get(d.from);
      node.out += d.flow;
      node.to.push({key: d.to, flow: d.flow});
    }
    if (!nodes.has(d.to)) {
      nodes.set(d.to, {key: d.to, in: d.flow, out: 0, from: [{key: d.from, flow: d.flow}], to: []});
    } else {
      const node = nodes.get(d.to);
      node.in += d.flow;
      node.from.push({key: d.from, flow: d.flow});
    }
  }

  const flowSort = (a, b) => b.flow - a.flow;

  [...nodes.values()].forEach(node => {
    let tmp = 0;
    node.from = node.from.sort(flowSort);
    node.from.forEach(x => {
      x.node = nodes.get(x.key);
      x.addY = tmp;
      tmp += x.flow;
    });

    tmp = 0;
    node.to = node.to.sort(flowSort);
    node.to.forEach(x => {
      x.node = nodes.get(x.key);
      x.addY = tmp;
      tmp += x.flow;
    });
  });

  return nodes;
}


function getAddY(arr, key) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].key === key) {
      return arr[i].addY;
    }
  }
  return 0;
}

export default class SankeyController extends DatasetController {

  parseObjectData(meta, data, start, count) {
    // https://github.com/chartjs/Chart.js/pull/8379
    if (count === 0) {
      return [];
    }
    const me = this;
    const {xScale, yScale} = meta;
    const parsed = [];
    const nodes = me._nodes = buildNodesFromFlows(data);
    const priority = me.getDataset().priority;
    if (priority) {
      for (const node of nodes.values()) {
        if (node.key in priority) {
          node.priority = priority[node.key];
        }
      }
    }

    const {maxX, maxY} = layout(nodes, data, !!priority);

    me._maxX = maxX;
    me._maxY = maxY;

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i];
      const from = nodes.get(flow.from);
      const to = nodes.get(flow.to);
      const fromY = from.y + getAddY(from.to, flow.to);
      const toY = to.y + getAddY(to.from, flow.from);
      parsed.push({
        x: xScale.parse(from.x, i),
        y: yScale.parse(fromY, i),
        _custom: {
          from,
          to,
          x: xScale.parse(to.x, i),
          y: yScale.parse(toY, i),
          height: yScale.parse(flow.flow, i),
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

  updateElements(elems, start, count, mode) {
    const me = this;
    const {xScale, yScale} = me._cachedMeta;
    const firstOpts = me.resolveDataElementOptions(start, mode);
    const sharedOptions = me.getSharedOptions(mode, elems[start], firstOpts);
    const dataset = me.getDataset();
    const borderWidth = valueOrDefault(dataset.borderWidth, 1) / 2 + 0.5;
    const nodeWidth = valueOrDefault(dataset.nodeWidth, 10);

    for (let i = start; i < start + count; i++) {
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
    const dataset = me.getDataset();
    const borderWidth = valueOrDefault(dataset.borderWidth, 1);
    const nodeWidth = valueOrDefault(dataset.nodeWidth, 10);
    const labels = dataset.labels;
    const {xScale, yScale} = me._cachedMeta;

    ctx.save();
    const chartArea = me.chart.chartArea;
    for (const node of nodes.values()) {
      const x = xScale.getPixelForValue(node.x);
      const y = yScale.getPixelForValue(node.y);
      const max = Math.max(node.in, node.out);
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

  _drawLabel(label, y, height, ctx, textX) {
    const lines = isNullOrUndef(label) ? [] : this.toTextLines(label);
    const linesLength = lines.length;
    const middle = y + height / 2;
    const padding = 7.5;
    const textHeight = 15;

    if (linesLength > 1) {
      const top = middle - (textHeight * linesLength / 2) + padding;
      for (let i = 0; i < linesLength; i++) {
        ctx.fillText(lines[i], textX, top + (i * textHeight));
      }
    } else {
      ctx.fillText(label, textX, middle);
    }
  }

  // @todo move this in Chart.helpers.toTextLines
  toTextLines(inputs) {
    var lines = [];
    var input;

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
    const dataset = me.getDataset();
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
      const max = Math.max(node.in, node.out);
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
      if (borderWidth) {
        ctx.strokeRect(x, y, nodeWidth, height);
      }
      ctx.fillRect(x, y, nodeWidth, height);
    }
    ctx.restore();
  }

  draw() {
    const me = this;
    const ctx = me._ctx;
    const data = me.getMeta().data || [];

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i];
      flow.from.color = flow.options.colorFrom;
      flow.to.color = flow.options.colorTo;
    }

    me._drawNodes();

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx);
    }

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
    },
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
      }
    },
    legend: {
      display: false
    },
  },
  scales: {
    x: {
      type: 'linear',
      bounds: 'data',
      display: false,
      min: 0,
      offset: false
    },
    y: {
      type: 'linear',
      bounds: 'data',
      display: false,
      min: 0,
      reverse: true,
      offset: false
    }
  },
  layout: {
    padding: {
      top: 3,
      left: 3,
      right: 13,
      bottom: 3
    }
  }
};
