/**
 * @param nodes {Map<string, SankeyNode>}
 * @param data {Array<SankeyDataPoint>}
 * @return {number}
 */
export function calculateX(nodes, data) {
  const to = new Set(data.map(x => x.to));
  const from = new Set(data.map(x => x.from));
  const keys = new Set([...nodes.keys()]);
  let x = 0;
  while (keys.size) {
    const column = nextColumn([...keys], to);
    for (let i = 0; i < column.length; i++) {
      nodes.get(column[i]).x = x;
      keys.delete(column[i]);
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
      nodes.get(key).x = x;
    });

  return x;
}

/**
 * @param keys {Array<string>}
 * @param to {Set<string>}
 * @return {Array<string>}
 */
function nextColumn(keys, to) {
  const columnsNotInTo = keys.filter(key => !to.has(key));
  return columnsNotInTo.length ? columnsNotInTo : keys.slice(0, 1);
}

/**
 * @param x {any}
 * @return {boolean}
 */
const defined = x => x !== undefined;

/**
 * @param a {SankeyNode}
 * @param b {SankeyNode}
 * @return {number}
 */
const nodeByXY = (a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y;

/**
 * @param list {Array<FromToElement>}
 * @param prop {string}
 * @return {number}
 */
const nodeCount = (list, prop) => list.reduce((acc, cur) => acc + cur.node[prop].length + nodeCount(cur.node[prop], prop), 0);

/**
 * @param prop {string}
 * @return {function(FromToElement, FromToElement): number}
 */
const flowByNodeCount = (prop) => (a, b) => nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop);

/**
 * @param nodeArray {Array<SankeyNode>}
 * @return {SankeyNode}
 */
function findLargestNode(nodeArray) {
  return nodeArray.sort((a, b) => {
    return Math.max(b.in, b.out) - Math.max(a.in, a.out);
  })[0];
}

/**
 * @param node {SankeyNode}
 * @param y {number}
 * @return {number}
 */
function processFrom(node, y) {
  node.from.sort(flowByNodeCount('from')).forEach(flow => {
    const n = flow.node;
    if (!defined(n.y)) {
      n.y = y;
      y = Math.max(y + n.out, processFrom(n, y));
    }
  });
  return y;
}

/**
 * @param node {SankeyNode}
 * @param y {number}
 * @return {number}
 */
function processTo(node, y) {
  node.to.sort(flowByNodeCount('to')).forEach(flow => {
    const n = flow.node;
    if (!defined(n.y)) {
      n.y = y;
      y = Math.max(y + n.in, processTo(n, y));
    }
  });
  return y;
}

/**
 * @param node {SankeyNode}
 * @param value {number}
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
 * @param nodeArray {Array<SankeyNode>}
 * @param maxX {number}
 * @return {number}
 */
function processRest(nodeArray, maxX) {
  const leftNodes = nodeArray.filter(node => node.x === 0);
  const rightNodes = nodeArray.filter(node => node.x === maxX);
  const leftToDo = leftNodes.filter(node => !defined(node.y));
  const rightToDo = rightNodes.filter(node => !defined(node.y));

  let leftY = leftNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.out) || 0), 0);
  let rightY = rightNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.in) || 0), 0);

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

  return Math.max(leftY, rightY);
}

/**
 * @param nodeArray {Array<SankeyNode>}
 * @param maxX {number}
 * @return {number}
 */
export function calculateY(nodeArray, maxX) {
  const start = findLargestNode(nodeArray);
  start.y = 0;
  const left = processFrom(start, 0);
  const right = processTo(start, 0);
  const rest = processRest(nodeArray, maxX);
  return Math.max(left, right, rest);
}

/**
 * @param nodeArray {Array<SankeyNode>}
 * @param maxX {number}
 * @return {number}
 */
export function calculateYUsingPriority(nodeArray, maxX) {
  let maxY = 0;
  for (let x = 0; x <= maxX; x++) {
    let y = 0;
    const nodes = nodeArray.filter(node => node.x === x).sort((a, b) => a.priority - b.priority);
    for (const node of nodes) {
      node.y = y;
      y += Math.max(node.out, node.in);
    }
    maxY = Math.max(y, maxY);
  }
  return maxY;
}

/**
 * @param nodeArray {Array<SankeyNode>}
 * @param maxX {number}
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
 * @param nodeArray {Array<SankeyNode>}
 * @param padding {number}
 * @return {number}
 */
export function addPadding(nodeArray, padding) {
  let i = 1;
  let x = 0;
  let prev = 0;
  let maxY = 0;
  const rows = [];
  nodeArray.sort(nodeByXY).forEach(node => {
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
  });
  return maxY;
}

/**
 * @param nodeArray {Array<SankeyNode>}
 * @param size {'min' | 'max'}
 */
export function sortFlows(nodeArray, size) {
  nodeArray.forEach((node) => {
    let addY = 0;
    node.from.sort((a, b) => (a.node.y + a.node.out / 2) - (b.node.y + b.node.out / 2)).forEach(flow => {
      flow.addY = addY;
      addY += flow.flow;
    });
    addY = 0;
    const len = node.to.length;
    const selectedSize = Math[size](node.in || node.out, node.out || node.in);
    node.to.sort((a, b) => (a.node.y + a.node.in / 2) - (b.node.y + b.node.in / 2)).forEach((flow, idx) => {
      if (selectedSize < node.out) {
        flow.addY = idx * (selectedSize - flow.flow) / (len - 1);
      } else {
        flow.addY = addY;
        addY += flow.flow;
      }
    });
  });
}

/**
 * @param nodes {Map<string, SankeyNode>}
 * @param data {Array<SankeyDataPoint>}
 * @param priority {boolean}
 * @param size {'min' | 'max'}
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
