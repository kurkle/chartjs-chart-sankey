import type {
  AnyObject,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyNode,
} from '../types.js'

import { validateSizeValue } from './helpers.js'

const flowSort = (a: FromToElement, b: FromToElement) => {
  // In case the flows are equal, keep original order
  if (b.flow === a.flow) return a.index - b.index

  return b.flow - a.flow
}

const setSizes = (nodes: Map<string, SankeyNode>, size: SankeyControllerDatasetOptions['size']) => {
  const sizeMethod = validateSizeValue(size)

  for (const node of nodes.values()) {
    node.from.sort(flowSort)
    node.to.sort(flowSort)
    // Fallbacks with || are for zero values and min method to avoid zero size.
    node.size = Math[sizeMethod](node.in || node.out, node.out || node.in)
  }
}

const setPriorities = (
  nodes: Map<string, SankeyNode>,
  priority: SankeyControllerDatasetOptions['priority']
) => {
  if (!priority) return

  for (const node of nodes.values()) {
    if (node.key in priority) {
      node.priority = priority[node.key]
    }
  }
}

const setColumns = (
  nodes: Map<string, SankeyNode>,
  column: SankeyControllerDatasetOptions['column']
) => {
  if (!column) return

  for (const node of nodes.values()) {
    if (node.key in column) {
      node.column = true
      node.x = column[node.key]
    }
  }
}

export const getParsedData = (
  data: AnyObject[],
  parsing: SankeyControllerDatasetOptions['parsing']
) => {
  const { from: fromKey = 'from', to: toKey = 'to', flow: flowKey = 'flow' } = parsing

  return data.map(
    ({ [fromKey]: from, [toKey]: to, [flowKey]: flow }) => ({ flow, from, to }) as SankeyDataPoint
  )
}

export function buildNodesFromData(
  data: SankeyDataPoint[],
  { size, priority, column }: Pick<SankeyControllerDatasetOptions, 'size' | 'priority' | 'column'>
): Map<string, SankeyNode> {
  const nodes = new Map<string, SankeyNode>()
  for (let i = 0; i < data.length; i++) {
    const { from, to, flow } = data[i]

    const fromNode: SankeyNode = nodes.get(from) ?? {
      from: [],
      in: 0,
      key: from,
      out: 0,
      size: 0,
      to: [],
    }

    const toNode: SankeyNode = (from === to ? fromNode : nodes.get(to)) ?? {
      from: [],
      in: 0,
      key: to,
      out: 0,
      size: 0,
      to: [],
    }

    fromNode.out += flow
    fromNode.to.push({ addY: 0, flow: flow, index: i, key: to, node: toNode })
    if (fromNode.to.length === 1) {
      nodes.set(from, fromNode)
    }

    toNode.in += flow
    toNode.from.push({ addY: 0, flow: flow, index: i, key: from, node: fromNode })
    if (toNode.from.length === 1) {
      nodes.set(to, toNode)
    }
  }

  setSizes(nodes, size)
  setPriorities(nodes, priority)
  setColumns(nodes, column)

  return nodes
}
