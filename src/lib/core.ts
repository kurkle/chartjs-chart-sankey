import type {
  AnyObject,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyNode,
} from '../types.js'

import { validateSizeValue } from './helpers.js'

export const getParsedData = (
  data: AnyObject[],
  parsing: SankeyControllerDatasetOptions['parsing']
) => {
  const { from: fromKey = 'from', to: toKey = 'to', flow: flowKey = 'flow' } = parsing

  return data.map(
    ({ [fromKey]: from, [toKey]: to, [flowKey]: flow }) => ({ flow, from, to }) as SankeyDataPoint
  )
}

/** The largest flow first; equal flows keep the order of the data. */
const bySize = (a: FromToElement, b: FromToElement) => b.flow - a.flow || a.index - b.index

/** The nodes in the order the data first mentions them, with their flows, size, priority and pinned column. */
export function buildNodesFromData(
  data: SankeyDataPoint[],
  { size, priority, column }: Pick<SankeyControllerDatasetOptions, 'size' | 'priority' | 'column'>
): Map<string, SankeyNode> {
  const nodes = new Map<string, SankeyNode>()
  const nodeOf = (key: string) => {
    const node = nodes.get(key) ?? { from: [], in: 0, key, out: 0, size: 0, to: [] }
    nodes.set(key, node)
    return node
  }
  data.forEach(({ from, to, flow }, index) => {
    const source = nodeOf(from)
    const target = nodeOf(to)
    source.out += flow
    source.to.push({ flow, index, key: to, node: target })
    target.in += flow
    target.from.push({ flow, index, key: from, node: source })
  })

  const sizeMethod = validateSizeValue(size)
  for (const node of nodes.values()) {
    node.from.sort(bySize)
    node.to.sort(bySize)
    // Fallbacks with || are for zero values and min method to avoid zero size.
    node.size = Math[sizeMethod](node.in || node.out, node.out || node.in)
    if (priority && node.key in priority) node.priority = priority[node.key]
    if (column && node.key in column) {
      node.column = true
      node.x = column[node.key]
    }
  }
  return nodes
}
