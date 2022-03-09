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
export function calculateX(nodes, data) {
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

/**
 * @param {Array<FromToElement>} list
 * @param {string} prop
 * @return {number}
 */
const nodeCount = (list, prop) => list.reduce((acc, cur) => acc + cur.node[prop].length + nodeCount(cur.node[prop], prop), 0);

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
export function calculateY(nodeArray, maxX) {
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
export function calculateYUsingPriority(nodeArray, maxX) {
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
 * @param {number} maxX
 * @return {number}
 */
export function maxRows(nodeArray, maxX) {
  let max = 0;
  for (let i = 0; i <= maxX; i++) {
    max = Math.max(max, nodeArray.filter(n => n.x === i).length);
  }
  return max;
}

/**
 * @param {Array<SankeyNode>} nodeArray
 * @param {number} padding
 * @return {number}
 */
export function addPadding(nodeArray, padding) {
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
export function sortFlows(nodeArray, size) {
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
export function layout(nodes, data, priority, size) {
  const nodeArray = [...nodes.values()];
  const maxX = calculateX(nodes, data);
  const maxY = priority ? calculateYUsingPriority(nodeArray, maxX) : calculateY(nodeArray, maxX);
  const padding = maxY * 0.03; // rows;
  const maxYWithPadding = addPadding(nodeArray, padding);
  sortFlows(nodeArray, size);
  return {maxX, maxY: maxYWithPadding};
}
