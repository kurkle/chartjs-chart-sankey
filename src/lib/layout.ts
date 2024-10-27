import type { FromToElement, SankeyDataPoint, SankeyNode } from 'chart.js'

import { defined } from './helpers'

const nextColumn = (keys: string[], to: Set<string>): string[] => {
  const columnsNotInTo = keys.filter((key) => !to.has(key))

  return columnsNotInTo.length ? columnsNotInTo : keys.slice(0, 1)
}

export function calculateX(nodes: Map<string, SankeyNode>, data: SankeyDataPoint[]): number {
  const to = new Set(data.map((dataPoint) => dataPoint.to))
  const from = new Set(data.map((dataPoint) => dataPoint.from))
  const keys = new Set([...nodes.keys()])
  let x = 0
  while (keys.size) {
    const column = nextColumn([...keys], to)
    for (const key of column) {
      const node = nodes.get(key)
      if (node && !defined(node.x)) {
        node.x = x
      }
      keys.delete(key)
    }
    if (keys.size) {
      to.clear()
      data.filter((flow) => keys.has(flow.from)).forEach((flow) => to.add(flow.to))
      x++
    }
  }
  ;[...nodes.keys()]
    .filter((key) => !from.has(key))
    .forEach((key) => {
      const node = nodes.get(key)
      // Only move the node to right edge, if it's column is not defined
      if (node && !node.column) {
        node.x = x
      }
    })

  return [...nodes.values()].reduce((max, node) => Math.max(max, node.x ?? 0), 0)
}

type NodeXY = Pick<SankeyNode, 'x' | 'y'>
const nodeByXY = (a: NodeXY, b: NodeXY): number => (a.x !== b.x ? a.x - b.x : a.y - b.y)

// @todo: this will break when there are multiple charts
let prevCountId = -1
function getCountId() {
  prevCountId = prevCountId < 100 ? prevCountId + 1 : 0
  return prevCountId
}

function nodeCount(list: Array<FromToElement>, prop: string, countId = getCountId()): number {
  let count = 0
  for (const elem of list) {
    if (elem.node._visited === countId) {
      continue
    }
    elem.node._visited = countId
    count += elem.node[prop].length + nodeCount(elem.node[prop], prop, countId)
  }
  return count
}

const flowByNodeCount =
  (prop: string): ((a: FromToElement, b: FromToElement) => number) =>
  (a, b) =>
    nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop) || a.node[prop].length - b.node[prop].length

function processFrom(node: SankeyNode, y: number): number {
  node.from.sort(flowByNodeCount('from'))
  for (const flow of node.from) {
    const n = flow.node
    if (!defined(n.y)) {
      n.y = y
      processFrom(n, y)
    }
    y = Math.max(n.y + n.out, y)
  }
  return y
}

function processTo(node: SankeyNode, y: number): number {
  node.to.sort(flowByNodeCount('to'))
  for (const flow of node.to) {
    const n = flow.node
    if (!defined(n.y)) {
      n.y = y
      processTo(n, y)
    }
    const size = Math.max(n.in, n.out)
    y = Math.max(n.y + size, y)
  }
  return y
}

function setOrGetY(node: SankeyNode, value: number): number {
  if (defined(node.y)) {
    return node.y
  }
  node.y = value
  return value
}

function processRest(nodeArray: SankeyNode[], maxX: number) {
  const leftNodes = nodeArray.filter((node) => node.x === 0)
  const rightNodes = nodeArray.filter((node) => node.x === maxX)
  const leftToDo = leftNodes.filter((node) => !defined(node.y))
  const rightToDo = rightNodes.filter((node) => !defined(node.y))
  const centerToDo = nodeArray.filter((node) => node.x! > 0 && node.x! < maxX && !defined(node.y))

  let leftY = leftNodes.reduce((acc, cur) => Math.max(acc, cur.y! + cur.out || 0), 0)
  let rightY = rightNodes.reduce((acc, cur) => Math.max(acc, cur.y! + cur.in || 0), 0)
  let centerY = 0

  if (leftY >= rightY) {
    leftToDo.forEach((node) => {
      leftY = setOrGetY(node, leftY)
      leftY = Math.max(leftY + node.out, processTo(node, leftY))
    })

    rightToDo.forEach((node) => {
      rightY = setOrGetY(node, rightY)
      rightY = Math.max(rightY + node.in, processTo(node, rightY))
    })
  } else {
    rightToDo.forEach((node) => {
      rightY = setOrGetY(node, rightY)
      rightY = Math.max(rightY + node.in, processTo(node, rightY))
    })

    leftToDo.forEach((node) => {
      leftY = setOrGetY(node, leftY)
      leftY = Math.max(leftY + node.out, processTo(node, leftY))
    })
  }
  centerToDo.forEach((node) => {
    let y = nodeArray
      .filter((n) => n.x === node.x && defined(n.y))
      .reduce((acc, cur) => Math.max(acc, cur.y! + Math.max(cur.in, cur.out)), 0)
    y = setOrGetY(node, y)
    y = Math.max(y + node.in, processFrom(node, y))
    y = Math.max(y + node.out, processTo(node, y))
    centerY = Math.max(centerY, y)
  })

  return Math.max(leftY, rightY, centerY)
}

export function calculateY(nodeArray: SankeyNode[], maxX: number): number {
  nodeArray.sort((a, b) => Math.max(b.in, b.out) - Math.max(a.in, a.out))
  const start = nodeArray[0]
  start.y = 0
  const left = processFrom(start, 0)
  const right = processTo(start, 0)
  const rest = processRest(nodeArray, maxX)
  return Math.max(left, right, rest)
}

export function calculateYUsingPriority(nodeArray: SankeyNode[], maxX: number) {
  let maxY = 0
  let nextYStart = 0
  for (let x = 0; x <= maxX; x++) {
    let y = nextYStart
    const nodes = nodeArray.filter((node) => node.x === x).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    nextYStart = nodes.length
      ? nodes[0].to.filter((to) => to.node.x! > x + 1).reduce((acc, cur) => acc + cur.flow, 0) || 0
      : 0
    for (const node of nodes) {
      node.y = y
      y += Math.max(node.out, node.in)
    }
    maxY = Math.max(y, maxY)
  }
  return maxY
}

/**
 * @return {number} maxY
 */
export function addPadding(nodeArray: Pick<SankeyNode, 'x' | 'y' | 'in' | 'out'>[], padding: number): number {
  let maxY = 0
  // const rows: number[] = [] // top left y of each row, exluding first row (y=0)
  const columnXs = new Map<number, number>()
  const grid: number[][] = []

  const getColIndex = (x: number) => {
    if (!columnXs.has(x)) {
      columnXs.set(x, grid.length)
      grid.push([])
    }
    return columnXs.get(x)
  }

  // sort nodes by x/y, so we can iterate them by rows
  nodeArray.sort(nodeByXY)

  for (const node of nodeArray) {
    const colIdx = getColIndex(node.x)
    const column = grid[colIdx]

    // figure out the max number of paddings in all columns above node.y
    if (node.y) {
      column.push(node.y)
      // Figure out the number of paddings needed. Start by the number of nodes above this in the same column.
      let paddings = column.length

      if (node.in) {
        // If the node has inputs, check all columsn left to this column and cound the nodes above this nodes y.
        // Use the maximun number of nodes above this node in any column left to it as number of paddings.
        for (let col = 0; col < colIdx; col++) {
          const otherColumn = grid[col]
          for (let row = 0; row < otherColumn.length; row++) {
            if (otherColumn[row] > node.y) break
            paddings = Math.max(row + 1, paddings)
          }
        }
        // update the column padding count by adding the same y multiple times if needed
        while (column.length < paddings) column.push(node.y)
      }

      // apply the paddings to the node
      node.y += paddings * padding
    }

    maxY = Math.max(maxY, node.y + Math.max(node.in, node.out))
  }

  return maxY
}

export function sortFlows(nodeArray: SankeyNode[], size: 'min' | 'max') {
  nodeArray.forEach((node) => {
    const nodeSize = Math[size](node.in || node.out, node.out || node.in)
    const overlapFrom = nodeSize < node.in
    const overlapTo = nodeSize < node.out
    let addY = 0
    let len = node.from.length
    node.from
      .sort((a, b) => a.node.y! + a.node.out / 2 - (b.node.y! + b.node.out / 2))
      .forEach((flow, idx) => {
        if (overlapFrom) {
          flow.addY = (idx * (nodeSize - flow.flow)) / (len - 1)
        } else {
          flow.addY = addY
          addY += flow.flow
        }
      })
    addY = 0
    len = node.to.length
    node.to
      .sort((a, b) => a.node.y! + a.node.in / 2 - (b.node.y! + b.node.in / 2))
      .forEach((flow, idx) => {
        if (overlapTo) {
          flow.addY = (idx * (nodeSize - flow.flow)) / (len - 1)
        } else {
          flow.addY = addY
          addY += flow.flow
        }
      })
  })
}

interface LayoutOptions {
  /** use node priority when sorting nodes vertically */
  priority: boolean
  /** node height */
  size: 'min' | 'max'
  /** canvas height (in pixels) */
  height: number
  /** vertical padding between nodes (in pixels) */
  nodePadding: number
}

export function layout(
  nodes: Map<string, SankeyNode>,
  data: SankeyDataPoint[],
  { priority, size, height, nodePadding }: LayoutOptions
): { maxY: number; maxX: number } {
  const nodeArray = [...nodes.values()]
  const maxX = calculateX(nodes, data)
  const maxY = priority ? calculateYUsingPriority(nodeArray, maxX) : calculateY(nodeArray, maxX)
  const padding = (maxY / height) * nodePadding
  const maxYWithPadding = addPadding(nodeArray, padding)

  sortFlows(nodeArray, size)

  return { maxX, maxY: maxYWithPadding }
}
