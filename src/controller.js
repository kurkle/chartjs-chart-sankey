'use strict';

import {DatasetController} from 'chart.js';
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

    const {maxX, maxY} = layout(nodes, data);

    xScale.options.max = maxX;
    yScale.options.max = maxY;

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

    for (let i = start; i < start + count; i++) {
      const parsed = me.getParsed(i);
      const custom = parsed._custom;
      const y = yScale.getPixelForValue(parsed.y);
      me.updateElement(
        elems[i],
        i,
        {
          x: xScale.getPixelForValue(parsed.x) + 11,
          y,
          x2: xScale.getPixelForValue(custom.x) - 1,
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
    const {xScale, yScale} = me._cachedMeta;

    ctx.save();
    const chartArea = me.chart.chartArea;

    for (const node of nodes.values()) {
      const x = xScale.getPixelForValue(node.x);
      const y = yScale.getPixelForValue(node.y);
      const max = Math.max(node.in, node.out);
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
      ctx.fillStyle = me.getDataset().color || 'black';
      ctx.textBaseline = 'middle';
      if (x < chartArea.width / 2) {
        ctx.textAlign = 'left';
        ctx.fillText(node.key, x + 15, y + height / 2);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(node.key, x - 5, y + height / 2);
      }
    }
    ctx.restore();
  }

  _drawNodes() {
    const me = this;
    const ctx = me._ctx;
    const nodes = me._nodes || new Map();
    const {xScale, yScale} = me._cachedMeta;

    ctx.save();
    ctx.strokeStyle = 'black';

    for (const node of nodes.values()) {
      ctx.fillStyle = node.color;
      const x = xScale.getPixelForValue(node.x);
      const y = yScale.getPixelForValue(node.y);
      const max = Math.max(node.in, node.out);
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
      ctx.strokeRect(x, y, 10, height);
      ctx.fillRect(x, y, 10, height);
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

    me._drawLabels();
    me._drawNodes();

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx);
    }
  }
}

SankeyController.id = 'sankey';
SankeyController.defaults = {
  dataElementType: 'flow',
  dataElementOptions: [
    'colorFrom',
    'colorTo'
  ],
  interaction: {
    mode: 'nearest',
    intersect: true
  },
  datasets: {
    animation: (ctx) => {
      let delay = 0;
      let duration = 0;
      const parsed = ctx.chart.getDatasetMeta(ctx.datasetIndex).controller.getParsed(ctx.dataIndex);
      if (parsed) {
        delay = parsed.x * 500 + ctx.dataIndex * 20;
        duration = (parsed._custom.x - parsed.x) * 200;
      }
      return {
        numbers: {
          type: 'number',
          properties: ['x', 'y', 'x2', 'y2', 'height']
        },
        progress: {
          easing: 'linear',
          duration,
          delay
        },
        colors: {
          type: 'color',
          properties: ['colorFrom', 'colorTo'],
        },
        hide: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            to: 'transparent'
          }
        },
        show: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            from: 'transparent'
          }
        }
      };
    },
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
      display: false,
      min: 0,
      offset: true
    },
    y: {
      type: 'linear',
      display: false,
      min: 0,
      reverse: true,
      offset: true
    }
  },
  layout: {
    padding: {
      right: 10
    }
  }
};
