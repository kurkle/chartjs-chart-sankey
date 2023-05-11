/*!
 * chartjs-chart-sankey v0.12.0
 * https://github.com/kurkle/chartjs-chart-sankey#readme
 * (c) 2023 Jukka Kurkela
 * Released under the MIT license
 */
(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('chart.js'), require('chart.js/helpers')) :
typeof define === 'function' && define.amd ? define(['chart.js', 'chart.js/helpers'], factory) :
(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Chart, global.Chart.helpers));
})(this, (function (chart_js, helpers) { 'use strict';

/**
 * @param {string | Array<string>} raw
 * @return {Array<string>}
 */
function toTextLines(raw) {
  const lines = [];
  const inputs = helpers.isArray(raw) ? raw : helpers.isNullOrUndef(raw) ? [] : [raw];

  while (inputs.length) {
    const input = inputs.pop();
    if (typeof input === 'string') {
      lines.unshift.apply(lines, input.split('\n'));
    } else if (Array.isArray(input)) {
      inputs.push.apply(inputs, input);
    } else if (!helpers.isNullOrUndef(inputs)) {
      lines.unshift('' + input);
    }
  }

  return lines;
}

/**
* @param {any} size
* @return {'min' | 'max'}
*/
function validateSizeValue(size) {
  if (!size || ['min', 'max'].indexOf(size) === -1) {
    return 'max';
  }
  return size;
}

/**
 * @param x {any}
 * @return {boolean}
 */
const defined = x => x !== undefined;

/**
 * @param {Map<string, SankeyNode>} nodes
 * @param {Array<SankeyDataPoint>} data
 * @return {number}
 */
function calculateX(nodes, data) {
  const to = new Set(data.map(dataPoint => dataPoint.to));
  const from = new Set(data.map(dataPoint => dataPoint.from));
  const keys = new Set([...nodes.keys()]);
  let x = 0;
  while (keys.size) {
    const column = nextColumn([...keys], to);
    for (const key of column) {
      const node = nodes.get(key);
      if (!defined(node.x)) {
        node.x = x;
      }
      keys.delete(key);
    }
    if (keys.size) {
      to.clear();
      data.filter(flow => keys.has(flow.from)).forEach(flow => to.add(flow.to));
      x++;
    }
  }
  [...nodes.keys()]
    .filter(key => !from.has(key))
    .forEach(key => {
      const node = nodes.get(key);
      // Only move the node to right edge, if it's column is not defined
      if (!node.column) {
        node.x = x;
      }
    });

  return x;
}

/**
 * @param {Array<string>} keys
 * @param {Set<string>} to
 * @return {Array<string>}
 */
function nextColumn(keys, to) {
  const columnsNotInTo = keys.filter(key => !to.has(key));
  return columnsNotInTo.length ? columnsNotInTo : keys.slice(0, 1);
}

/**
 * @param {SankeyNode} a
 * @param {SankeyNode} b
 * @return {number}
 */
const nodeByXY = (a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y;

let prevCountId = -1;
function getCountId() {
  prevCountId = prevCountId < 100 ? prevCountId + 1 : 0;
  return prevCountId;
}

/**
 * @param {Array<FromToElement>} list
 * @param {string} prop
 * @return {number}
 */
function nodeCount(list, prop, countId = getCountId()) {
  let count = 0;
  for (const elem of list) {
    if (elem.node._visited === countId) {
      continue;
    }
    elem.node._visited = countId;
    count += elem.node[prop].length + nodeCount(elem.node[prop], prop, countId);
  }
  return count;
}

/**
 * @param {string} prop
 * @return {function(FromToElement, FromToElement): number}
 */
const flowByNodeCount = (prop) => (a, b) => (nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop)) || (a.node[prop].length - b.node[prop].length);

/**
 * @param {SankeyNode} node
 * @param {number} y
 * @return {number}
 */
function processFrom(node, y) {
  node.from.sort(flowByNodeCount('from'));
  for (const flow of node.from) {
    const n = flow.node;
    if (!defined(n.y)) {
      n.y = y;
      processFrom(n, y);
    }
    y = Math.max(n.y + n.out, y);
  }
  return y;
}

/**
 * @param {SankeyNode} node
 * @param {number} y
 * @return {number}
 */
function processTo(node, y) {
  node.to.sort(flowByNodeCount('to'));
  for (const flow of node.to) {
    const n = flow.node;
    if (!defined(n.y)) {
      n.y = y;
      processTo(n, y);
    }
    y = Math.max(n.y + n.in, y);
  }
  return y;
}

/**
 * @param {SankeyNode} node
 * @param {number} value
 * @return {number}
 */
function setOrGetY(node, value) {
  if (defined(node.y)) {
    return node.y;
  }
  node.y = value;
  return value;
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {number} maxX
 * @return {number}
 */
function processRest(nodeArray, maxX) {
  const leftNodes = nodeArray.filter(node => node.x === 0);
  const rightNodes = nodeArray.filter(node => node.x === maxX);
  const leftToDo = leftNodes.filter(node => !defined(node.y));
  const rightToDo = rightNodes.filter(node => !defined(node.y));
  const centerToDo = nodeArray.filter(node => node.x > 0 && node.x < maxX && !defined(node.y));

  let leftY = leftNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.out) || 0), 0);
  let rightY = rightNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.in) || 0), 0);
  let centerY = 0;

  if (leftY >= rightY) {
    leftToDo.forEach(node => {
      leftY = setOrGetY(node, leftY);
      leftY = Math.max(leftY + node.out, processTo(node, leftY));
    });

    rightToDo.forEach(node => {
      rightY = setOrGetY(node, rightY);
      rightY = Math.max(rightY + node.in, processTo(node, rightY));
    });
  } else {
    rightToDo.forEach(node => {
      rightY = setOrGetY(node, rightY);
      rightY = Math.max(rightY + node.in, processTo(node, rightY));
    });

    leftToDo.forEach(node => {
      leftY = setOrGetY(node, leftY);
      leftY = Math.max(leftY + node.out, processTo(node, leftY));
    });
  }
  centerToDo.forEach(node => {
    let y = nodeArray.filter(n => n.x === node.x && defined(n.y))
      .reduce((acc, cur) => Math.max(acc, cur.y + Math.max(cur.in, cur.out)), 0);
    y = setOrGetY(node, y);
    y = Math.max(y + node.in, processFrom(node, y));
    y = Math.max(y + node.out, processTo(node, y));
    centerY = Math.max(centerY, y);
  });

  return Math.max(leftY, rightY, centerY);
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {number} maxX
 * @return {number}
 */
function calculateY(nodeArray, maxX) {
  nodeArray.sort((a, b) => Math.max(b.in, b.out) - Math.max(a.in, a.out));
  const start = nodeArray[0];
  start.y = 0;
  const left = processFrom(start, 0);
  const right = processTo(start, 0);
  const rest = processRest(nodeArray, maxX);
  return Math.max(left, right, rest);
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {number} maxX
 * @return {number}
 */
function calculateYUsingPriority(nodeArray, maxX) {
  let maxY = 0;
  let nextYStart = 0;
  for (let x = 0; x <= maxX; x++) {
    let y = nextYStart;
    const nodes = nodeArray.filter(node => node.x === x).sort((a, b) => a.priority - b.priority);
    nextYStart = nodes[0].to.filter(to => to.node.x > x + 1).reduce((acc, cur) => acc + cur.flow, 0) || 0;
    for (const node of nodes) {
      node.y = y;
      y += Math.max(node.out, node.in);
    }
    maxY = Math.max(y, maxY);
  }
  return maxY;
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {number} padding
 * @return {number}
 */
function addPadding(nodeArray, padding) {
  let i = 1;
  let x = 0;
  let prev = 0;
  let maxY = 0;
  const rows = [];
  nodeArray.sort(nodeByXY);
  for (const node of nodeArray) {
    if (node.y) {
      if (node.x === 0) {
        rows.push(node.y);
      } else {
        if (x !== node.x) {
          x = node.x;
          prev = 0;
        }

        for (i = prev + 1; i < rows.length; i++) {
          if (rows[i] > node.y) {
            break;
          }
        }
        prev = i;
      }
      node.y += i * padding;
      i++;
    }
    maxY = Math.max(maxY, node.y + Math.max(node.in, node.out));
  }
  return maxY;
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {'min' | 'max'} size
 */
function sortFlows(nodeArray, size) {
  nodeArray.forEach((node) => {
    const nodeSize = Math[size](node.in || node.out, node.out || node.in);
    const overlapFrom = nodeSize < node.in;
    const overlapTo = nodeSize < node.out;
    let addY = 0;
    let len = node.from.length;
    node.from.sort((a, b) => (a.node.y + a.node.out / 2) - (b.node.y + b.node.out / 2)).forEach((flow, idx) => {
      if (overlapFrom) {
        flow.addY = idx * (nodeSize - flow.flow) / (len - 1);
      } else {
        flow.addY = addY;
        addY += flow.flow;
      }
    });
    addY = 0;
    len = node.to.length;
    node.to.sort((a, b) => (a.node.y + a.node.in / 2) - (b.node.y + b.node.in / 2)).forEach((flow, idx) => {
      if (overlapTo) {
        flow.addY = idx * (nodeSize - flow.flow) / (len - 1);
      } else {
        flow.addY = addY;
        addY += flow.flow;
      }
    });
  });
}

/**
 * @param {Map<string, SankeyNode>} nodes
 * @param {Array<SankeyDataPoint>} data
 * @param {boolean} priority
 * @param {'min' | 'max'} size
 * @return {{maxY: number, maxX: number}}
 */
function layout(nodes, data, priority, size) {
  const nodeArray = [...nodes.values()];
  const maxX = calculateX(nodes, data);
  const maxY = priority ? calculateYUsingPriority(nodeArray, maxX) : calculateY(nodeArray, maxX);
  const padding = maxY * 0.03; // rows;
  const maxYWithPadding = addPadding(nodeArray, padding);
  sortFlows(nodeArray, size);
  return {maxX, maxY: maxYWithPadding};
}

/**
 * @param {Array<SankeyDataPoint>} data Array of raw data elements
 * @return {Map<string, SankeyNode>}
 */
function buildNodesFromRawData(data) {
  const nodes = new Map();
  for (let i = 0; i < data.length; i++) {
    const {from, to, flow} = data[i];

    if (!nodes.has(from)) {
      nodes.set(from, {
        key: from,
        in: 0,
        out: flow,
        from: [],
        to: [{key: to, flow: flow, index: i}],
      });
    } else {
      const node = nodes.get(from);
      node.out += flow;
      node.to.push({key: to, flow: flow, index: i});
    }
    if (!nodes.has(to)) {
      nodes.set(to, {
        key: to,
        in: flow,
        out: 0,
        from: [{key: from, flow: flow, index: i}],
        to: [],
      });
    } else {
      const node = nodes.get(to);
      node.in += flow;
      node.from.push({key: from, flow: flow, index: i});
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
 * @param {Array<FromToElement>} arr
 * @param {string} key
 * @param {number} index
 * @return {number}
 */
function getAddY(arr, key, index) {
  for (const item of arr) {
    if (item.key === key && item.index === index) {
      return item.addY;
    }
  }
  return 0;
}

class SankeyController extends chart_js.DatasetController {
  /**
   * @param {ChartMeta<Flow, Element>} meta
   * @param {Array<SankeyDataPoint>} data Array of original data elements
   * @param {number} start
   * @param {number} count
   * @return {Array<SankeyParsedData>}
   */
  parseObjectData(meta, data, start, count) {
    const {from: fromKey = 'from', to: toKey = 'to', flow: flowKey = 'flow'} = this.options.parsing;
    const sankeyData = data.map(({[fromKey]: from, [toKey]: to, [flowKey]: flow}) => ({from, to, flow}));
    const {xScale, yScale} = meta;
    const parsed = []; /* Array<SankeyParsedData> */
    const nodes = this._nodes = buildNodesFromRawData(sankeyData);
    /* getDataset() => SankeyControllerDatasetOptions */
    const {column, priority, size} = this.getDataset();
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

    for (let i = 0, ilen = sankeyData.length; i < ilen; ++i) {
      const dataPoint = sankeyData[i];
      const from = nodes.get(dataPoint.from);
      const to = nodes.get(dataPoint.to);
      const fromY = from.y + getAddY(from.to, dataPoint.to, i);
      const toY = to.y + getAddY(to.from, dataPoint.from, i);
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
    return {
      min: 0,
      max: scale === this._cachedMeta.xScale ? this._maxX : this._maxY
    };
  }

  update(mode) {
    const {data} = this._cachedMeta;

    this.updateElements(data, 0, data.length, mode);
  }

  /**
   * @param {Array<Flow>} elems
   * @param {number} start
   * @param {number} count
   * @param {"resize" | "reset" | "none" | "hide" | "show" | "normal" | "active"} mode
   */
  updateElements(elems, start, count, mode) {
    const {xScale, yScale} = this._cachedMeta;
    const firstOpts = this.resolveDataElementOptions(start, mode);
    const sharedOptions = this.getSharedOptions(mode, elems[start], firstOpts);
    const dataset = this.getDataset();
    const borderWidth = helpers.valueOrDefault(dataset.borderWidth, 1) / 2 + 0.5;
    const nodeWidth = helpers.valueOrDefault(dataset.nodeWidth, 10);

    for (let i = start; i < start + count; i++) {
      /* getParsed(idx: number) => SankeyParsedData */
      const parsed = this.getParsed(i);
      const custom = parsed._custom;
      const y = yScale.getPixelForValue(parsed.y);
      this.updateElement(
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
          options: this.resolveDataElementOptions(i, mode)
        },
        mode);
    }

    this.updateSharedOptions(sharedOptions, mode);
  }

  _drawLabels() {
    const ctx = this._ctx;
    const nodes = this._nodes || new Map();
    const dataset = this.getDataset(); /* SankeyControllerDatasetOptions */
    const size = validateSizeValue(dataset.size);
    const borderWidth = helpers.valueOrDefault(dataset.borderWidth, 1);
    const nodeWidth = helpers.valueOrDefault(dataset.nodeWidth, 10);
    const labels = dataset.labels;
    const {xScale, yScale} = this._cachedMeta;

    ctx.save();
    const chartArea = this.chart.chartArea;
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
   * @param {string} label
   * @param {number} y
   * @param {number} height
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} textX
   * @private
   */
  _drawLabel(label, y, height, ctx, textX) {
    const font = helpers.toFont(this.options.font, this.chart.options.font);
    const lines = helpers.isNullOrUndef(label) ? [] : toTextLines(label);
    const linesLength = lines.length;
    const middle = y + height / 2;
    const textHeight = font.lineHeight;
    const padding = helpers.valueOrDefault(this.options.padding, textHeight / 2);

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

  _drawNodes() {
    const ctx = this._ctx;
    const nodes = this._nodes || new Map();
    const dataset = this.getDataset();  /* SankeyControllerDatasetOptions */
    const size = validateSizeValue(dataset.size);
    const {xScale, yScale} = this._cachedMeta;
    const borderWidth = helpers.valueOrDefault(dataset.borderWidth, 1);
    const nodeWidth = helpers.valueOrDefault(dataset.nodeWidth, 10);

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
    const ctx = this._ctx;
    const data = this.getMeta().data || []; /* Array<Flow> */

    // Set node colors
    const active = [];
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

    /* draw SankeyNodes on the canvas */
    this._drawNodes();

    /* draw Flow elements on the canvas */
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx);
    }

    /* draw labels (for SankeyNodes) on the canvas */
    this._drawLabels();
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

/**
 * @typedef {{x: number, y: number}} ControlPoint
 * @typedef {{cp1: ControlPoint, cp2: ControlPoint}} ControlPoints
 *
 * @param {number} x
 * @param {number} y
 * @param {number} x2
 * @param {number} y2
 * @return {ControlPoints}
 */
const controlPoints = (x, y, x2, y2) => x < x2
  ? {
    cp1: {x: x + (x2 - x) / 3 * 2, y},
    cp2: {x: x + (x2 - x) / 3, y: y2}
  }
  : {
    cp1: {x: x - (x - x2) / 3, y: 0},
    cp2: {x: x2 + (x - x2) / 3, y: 0}
  };

/**
 *
 * @param {ControlPoint} p1
 * @param {ControlPoint} p2
 * @param {number} t
 * @return {ControlPoint}
 */
const pointInLine = (p1, p2, t) => ({x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y)});

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Flow} flow
 */
function setStyle(ctx, {x, x2, options}) {
  let fill;

  if (options.colorMode === 'from') {
    fill = helpers.color(options.colorFrom).alpha(options.alpha).rgbString();
  } else if (options.colorMode === 'to') {
    fill = helpers.color(options.colorTo).alpha(options.alpha).rgbString();
  } else {
    fill = ctx.createLinearGradient(x, 0, x2, 0);
    fill.addColorStop(0, helpers.color(options.colorFrom).alpha(options.alpha).rgbString());
    fill.addColorStop(1, helpers.color(options.colorTo).alpha(options.alpha).rgbString());
  }

  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = 0.5;
}

class Flow extends chart_js.Element {

  /**
   * @param {FlowConfig} cfg
   */
  constructor(cfg) {
    super();

    this.options = undefined;
    this.x = undefined;
    this.y = undefined;
    this.x2 = undefined;
    this.y2 = undefined;
    this.height = undefined;

    if (cfg) {
      Object.assign(this, cfg);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const me = this;
    const {x, x2, y, y2, height, progress} = me;
    const {cp1, cp2} = controlPoints(x, y, x2, y2);

    if (progress === 0) {
      return;
    }
    ctx.save();
    if (progress < 1) {
      ctx.beginPath();
      ctx.rect(x, Math.min(y, y2), (x2 - x) * progress + 1, Math.abs(y2 - y) + height + 1);
      ctx.clip();
    }

    setStyle(ctx, me);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2);
    ctx.lineTo(x2, y2 + height);
    ctx.bezierCurveTo(cp2.x, cp2.y + height, cp1.x, cp1.y + height, x, y + height);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();

    ctx.fill();

    ctx.restore();
  }

  /**
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inRange(mouseX, mouseY, useFinalPosition) {
    const {x, y, x2, y2, height} = this.getProps(['x', 'y', 'x2', 'y2', 'height'], useFinalPosition);
    if (mouseX < x || mouseX > x2) {
      return false;
    }
    const {cp1, cp2} = controlPoints(x, y, x2, y2);
    const t = (mouseX - x) / (x2 - x);
    const p1 = {x, y};
    const p2 = {x: x2, y: y2};
    const a = pointInLine(p1, cp1, t);
    const b = pointInLine(cp1, cp2, t);
    const c = pointInLine(cp2, p2, t);
    const d = pointInLine(a, b, t);
    const e = pointInLine(b, c, t);
    const topY = pointInLine(d, e, t).y;
    return mouseY >= topY && mouseY <= topY + height;
  }

  /**
   * @param {number} mouseX
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inXRange(mouseX, useFinalPosition) {
    const {x, x2} = this.getProps(['x', 'x2'], useFinalPosition);
    return mouseX >= x && mouseX <= x2;
  }

  /**
   * @param {number} mouseY
   * @param {boolean} useFinalPosition
   * @return {boolean}
   */
  inYRange(mouseY, useFinalPosition) {
    const {y, y2, height} = this.getProps(['y', 'y2', 'height'], useFinalPosition);
    const minY = Math.min(y, y2);
    const maxY = Math.max(y, y2) + height;
    return mouseY >= minY && mouseY <= maxY;
  }

  /**
   * @param {boolean} useFinalPosition
   * @return {{x: number, y:number}}
   */
  getCenterPoint(useFinalPosition) {
    const {x, y, x2, y2, height} = this.getProps(['x', 'y', 'x2', 'y2', 'height'], useFinalPosition);
    return {
      x: (x + x2) / 2,
      y: (y + y2 + height) / 2
    };
  }

  tooltipPosition(useFinalPosition) {
    return this.getCenterPoint(useFinalPosition);
  }

  /**
   * @param {"x" | "y"} axis
   * @return {number}
   */
  getRange(axis) {
    return axis === 'x' ? this.width / 2 : this.height / 2;
  }
}

Flow.id = 'flow';
Flow.defaults = {
  colorFrom: 'red',
  colorTo: 'green',
  colorMode: 'gradient',
  alpha: 0.5,
  hoverColorFrom: (ctx, options) => helpers.getHoverColor(options.colorFrom),
  hoverColorTo: (ctx, options) => helpers.getHoverColor(options.colorTo)
};

chart_js.Chart.register(SankeyController, Flow);

}));
