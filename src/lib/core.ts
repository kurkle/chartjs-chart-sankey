import { FromToElement, SankeyDataPoint, SankeyNode } from 'chart.js'

const flowSort = (a: FromToElement, b: FromToElement) => {
  // In case the flows are equal, keep original order
  if (b.flow === a.flow) return a.index - b.index

  return b.flow - a.flow
}

export function buildNodesFromData(data: SankeyDataPoint[]): Map<string, SankeyNode> {
  const nodes = new Map<string, SankeyNode>()
  for (let i = 0; i < data.length; i++) {
    const { from, to, flow } = data[i]

    // ignore zero or negative flows
    if (flow <= 0) continue

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
    fromNode.to.push({ key: to, flow: flow, index: i, node: toNode, addY: 0 })
    if (fromNode.to.length === 1) {
      nodes.set(from, fromNode)
    }

    toNode.in += flow
    toNode.from.push({ key: from, flow: flow, index: i, node: fromNode, addY: 0 })
    if (toNode.from.length === 1) {
      nodes.set(to, toNode)
    }
  }

  for (const node of nodes.values()) {
    node.from.sort(flowSort)
    node.to.sort(flowSort)
  }

  return nodes
}
