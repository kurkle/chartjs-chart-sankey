import type { SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode } from '../types.js'

import { buildNodesFromData } from './core.js'
import { orderColumns } from './order.js'

export interface PlanLink {
  /** Index of the flow in the dataset */
  readonly index: number
  readonly flow: number
  readonly from: SankeyNode
  readonly to: SankeyNode
  /** The flow does not run from an earlier column to a later one */
  readonly back: boolean
}

export interface PlanPorts {
  /** Flows arriving at the node, in the order they meet its entry edge */
  readonly in: readonly PlanLink[]
  /** Flows leaving the node, in the order they meet its exit edge */
  readonly out: readonly PlanLink[]
}

/**
 * Everything about a chart that does not depend on its size: no pixels and no
 * value-unit positions. The nodes' `x` holds their column.
 */
export interface Plan {
  readonly nodes: ReadonlyMap<string, SankeyNode>
  readonly links: readonly PlanLink[]
  /** Nodes of each column in drawing order, empty columns included */
  readonly columns: readonly (readonly SankeyNode[])[]
  readonly maxColumn: number
  /** Extent of the legacy value-unit placement; goes away with it */
  readonly valueExtent: number
  readonly ports: ReadonlyMap<string, PlanPorts>
}

type TopologyOptions = Pick<
  SankeyControllerDatasetOptions,
  'column' | 'modeX' | 'priority' | 'size'
>

const num = (value: number) => (Number.isFinite(value) ? value : 0)

/**
 * Picks the flows that close a cycle. Flows are accepted from the largest to
 * the smallest (data order breaks ties); one that would close a cycle with the
 * ones already accepted is a back flow. Self flows are always back flows.
 */
function findCycleClosers(links: PlanLinkDraft[], nodeCount: number): Set<number> {
  const order = links
    .map((_, i) => i)
    .sort((a, b) => num(links[b].flow) - num(links[a].flow) || a - b)
  const accepted: number[][] = Array.from({ length: nodeCount }, () => [])
  const closers = new Set<number>()
  const seen = new Int32Array(nodeCount).fill(-1)

  const reaches = (start: number, target: number, stamp: number) => {
    const stack = [start]
    seen[start] = stamp
    while (stack.length) {
      const current = stack.pop() as number
      if (current === target) return true
      for (const next of accepted[current]) {
        if (seen[next] !== stamp) {
          seen[next] = stamp
          stack.push(next)
        }
      }
    }
    return false
  }

  order.forEach((linkIndex, stamp) => {
    const { from, to } = links[linkIndex]
    if (from === to || reaches(to, from, stamp)) {
      closers.add(linkIndex)
    } else {
      accepted[from].push(to)
    }
  })
  return closers
}

interface PlanLinkDraft {
  flow: number
  from: number
  to: number
}

/** Longest path from the sources over the accepted flows. */
function longestPaths(links: PlanLinkDraft[], closers: Set<number>, nodeCount: number): number[] {
  const outgoing: number[][] = Array.from({ length: nodeCount }, () => [])
  const missing = new Array<number>(nodeCount).fill(0)
  links.forEach(({ from, to }, i) => {
    if (!closers.has(i)) {
      outgoing[from].push(to)
      missing[to]++
    }
  })
  const column = new Array<number>(nodeCount).fill(0)
  const queue: number[] = []
  for (let i = 0; i < nodeCount; i++) {
    if (!missing[i]) queue.push(i)
  }
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    for (const next of outgoing[current]) {
      column[next] = Math.max(column[next], column[current] + 1)
      if (--missing[next] === 0) queue.push(next)
    }
  }
  return column
}

export function buildTopology(data: SankeyDataPoint[], options: TopologyOptions): Plan {
  const nodes = buildNodesFromData(data, options)
  const nodeList = [...nodes.values()]
  const indexOf = new Map(nodeList.map((node, i) => [node.key, i]))
  const drafts: PlanLinkDraft[] = data.map(({ flow, from, to }) => ({
    flow,
    from: indexOf.get(from) as number,
    to: indexOf.get(to) as number,
  }))

  const closers = findCycleClosers(drafts, nodeList.length)
  const columnOf = longestPaths(drafts, closers, nodeList.length)

  // A pinned column replaces the computed one without moving anything else.
  nodeList.forEach((node, i) => {
    if (node.column && node.x !== undefined) columnOf[i] = node.x
  })
  const maxColumn = columnOf.reduce((max, c) => Math.max(max, c), 0)
  if ((options.modeX ?? 'edge') === 'edge') {
    // Nodes without output go to the right edge, unless pinned.
    nodeList.forEach((node, i) => {
      if (!node.to.length && !node.column) columnOf[i] = maxColumn
    })
  }
  nodeList.forEach((node, i) => {
    node.x = columnOf[i]
  })

  const links: PlanLink[] = drafts.map((draft, index) => ({
    back:
      closers.has(index) || draft.from === draft.to || columnOf[draft.to] <= columnOf[draft.from],
    flow: draft.flow,
    from: nodeList[draft.from],
    index,
    to: nodeList[draft.to],
  }))

  const { columns, maxY } = orderColumns(nodeList, maxColumn, !!options.priority)
  const ports = buildPorts(nodeList, links, columns)

  return Object.freeze({
    columns: Object.freeze(columns.map((column) => Object.freeze(column))),
    links: Object.freeze(links),
    maxColumn,
    nodes,
    ports,
    valueExtent: maxY,
  })
}

/**
 * The flows of a node edge are ordered by where their other end is among its
 * column's nodes, so they do not cross each other on the way out. Back flows
 * come last.
 */
function buildPorts(
  nodes: SankeyNode[],
  links: PlanLink[],
  columns: SankeyNode[][]
): ReadonlyMap<string, PlanPorts> {
  const rank = new Map<string, number>()
  for (const column of columns) {
    column.forEach((node, i) => {
      rank.set(node.key, (i + 0.5) / column.length)
    })
  }
  const byEnd = (end: 'from' | 'to') => (a: PlanLink, b: PlanLink) =>
    Number(a.back) - Number(b.back) ||
    (rank.get(a[end].key) as number) - (rank.get(b[end].key) as number) ||
    a.index - b.index

  const incoming = new Map<string, PlanLink[]>()
  const outgoing = new Map<string, PlanLink[]>()
  for (const node of nodes) {
    incoming.set(node.key, [])
    outgoing.set(node.key, [])
  }
  for (const link of links) {
    incoming.get(link.to.key)?.push(link)
    outgoing.get(link.from.key)?.push(link)
  }
  const ports = new Map<string, PlanPorts>()
  for (const node of nodes) {
    ports.set(
      node.key,
      Object.freeze({
        in: Object.freeze((incoming.get(node.key) as PlanLink[]).sort(byEnd('from'))),
        out: Object.freeze((outgoing.get(node.key) as PlanLink[]).sort(byEnd('to'))),
      })
    )
  }
  return ports
}
