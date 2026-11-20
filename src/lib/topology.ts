import type { SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode } from '../types.js'

import { buildNodesFromData } from './core.js'
import { orderSlots } from './order.js'

/**
 * A place in a column: a node, or a waypoint of a flow that skips the column
 * (a virtual slot of the size of the flow, which belongs to that flow alone and
 * is never drawn as a node).
 */
export interface PlanSlot {
  /** The key of the node, or `<flow index>@<column>` for a waypoint */
  key: string
  column: number
  /** Its place in the column */
  row: number
  /** Size in flow units */
  size: number
  /** The node; a waypoint has none */
  node?: SankeyNode
  /** Flows arriving at the slot, in the order they meet its entry edge */
  in: PlanLink[]
  /** Flows leaving the slot, in the order they meet its exit edge */
  out: PlanLink[]
}

export interface PlanLink {
  /** Index of the flow in the dataset */
  index: number
  flow: number
  from: SankeyNode
  to: SankeyNode
  /** The flow does not run from an earlier column to a later one */
  back: boolean
  /**
   * Place of a back flow among the loops in the nesting order: shortest span
   * first, equal spans in data order. An empty flow has nothing to draw and
   * gets none.
   */
  rank?: number
  /**
   * The slots the flow passes: its source, a waypoint in every column it
   * skips, its target. A back flow has just its two ends.
   */
  path: PlanSlot[]
}

/**
 * Everything about a chart that does not depend on its size: no pixels and no
 * positions. The nodes' `x` holds their column. The plan is kept from one
 * update to the next, so nothing that reads it may change it.
 */
export interface Plan {
  nodes: Map<string, SankeyNode>
  links: PlanLink[]
  /** Slots of each column in drawing order, waypoints included; empty columns too */
  slots: PlanSlot[][]
  maxColumn: number
  /** The back flows that are drawn, in nesting order */
  loops: PlanLink[]
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
function findCycleClosers(data: SankeyDataPoint[]): Set<number> {
  const accepted = new Map<string, string[]>()
  const reaches = (start: string, target: string) => {
    const seen = new Set([start])
    const stack = [start]
    for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
      if (current === target) return true
      for (const next of accepted.get(current) ?? []) {
        if (!seen.has(next)) stack.push(next)
        seen.add(next)
      }
    }
    return false
  }
  const closers = new Set<number>()
  const bySize = data
    .map((_, i) => i)
    .sort((a, b) => num(data[b].flow) - num(data[a].flow) || a - b)
  for (const i of bySize) {
    const { from, to } = data[i]
    if (from === to || reaches(to, from)) closers.add(i)
    else accepted.set(from, [...(accepted.get(from) ?? []), to])
  }
  return closers
}

/** Longest path from the sources over the accepted flows. */
function longestPaths(nodes: Map<string, SankeyNode>, closers: Set<number>) {
  const forward = (node: SankeyNode) => node.to.filter(({ index }) => !closers.has(index))
  const missing = new Map<SankeyNode, number>()
  const column = new Map<SankeyNode, number>()
  for (const node of nodes.values()) {
    column.set(node, 0)
    for (const { node: next } of forward(node)) missing.set(next, (missing.get(next) ?? 0) + 1)
  }
  const queue = [...nodes.values()].filter((node) => !missing.has(node))
  // the queue grows while it is walked
  for (const current of queue) {
    for (const { node: next } of forward(current)) {
      column.set(next, Math.max(column.get(next) as number, (column.get(current) as number) + 1))
      missing.set(next, (missing.get(next) as number) - 1)
      if (!missing.get(next)) queue.push(next)
    }
  }
  return column
}

/**
 * Where a flow meets a slot of its path: the exit edge of its source, the
 * entry edge of its target, or both edges of a waypoint. A forward flow passes
 * one column per step; a back flow has just its two ends.
 */
export function pathIndex(link: PlanLink, slot: PlanSlot, end: 'in' | 'out'): number {
  if (link.back) return end === 'out' ? 0 : 1
  return slot.column - link.path[0].column
}

export function buildTopology(data: SankeyDataPoint[], options: TopologyOptions): Plan {
  const nodes = buildNodesFromData(data, options)
  const closers = findCycleClosers(data)
  const computed = longestPaths(nodes, closers)
  // A pinned column replaces the computed one without moving anything else.
  for (const node of nodes.values()) {
    if (!node.column || node.x === undefined) node.x = computed.get(node)
  }
  const column = (node: SankeyNode) => node.x as number
  const maxColumn = Math.max(0, ...[...nodes.values()].map(column))
  if ((options.modeX ?? 'edge') === 'edge') {
    // Nodes without output go to the right edge, unless pinned.
    for (const node of nodes.values()) {
      if (!node.to.length && !node.column) node.x = maxColumn
    }
  }

  // The columns start in the order the data first mentions their slots. Every
  // flow that skips columns gets a waypoint in each of them.
  const initial: PlanSlot[][] = Array.from({ length: maxColumn + 1 }, () => [])
  const create = (at: number, key: string, size: number, node?: SankeyNode) => {
    const slot: PlanSlot = { column: at, in: [], key, node, out: [], row: 0, size }
    initial[at].push(slot)
    return slot
  }
  const real = new Map<SankeyNode, PlanSlot>()
  const slotOf = (node: SankeyNode) => {
    const slot = real.get(node) ?? create(column(node), node.key, node.size, node)
    real.set(node, slot)
    return slot
  }
  const links = data.map(({ flow }, index): PlanLink => {
    const from = nodes.get(data[index].from) as SankeyNode
    const to = nodes.get(data[index].to) as SankeyNode
    const back = column(to) <= column(from)
    const path = [slotOf(from)]
    for (let c = column(from) + 1; !back && c < column(to); c++) {
      path.push(create(c, `${index}@${c}`, flow))
    }
    path.push(slotOf(to))
    const link = { back, flow, from, index, path, to }
    path.forEach((slot, i) => {
      if (i) slot.in.push(link)
      if (i < path.length - 1) slot.out.push(link)
    })
    return link
  })

  // Nested loops do not cross when the shortest span is the innermost.
  const span = (link: PlanLink) => column(link.from) - column(link.to)
  const loops = links
    .filter((link) => link.back && link.flow > 0)
    .sort((a, b) => span(a) - span(b) || a.index - b.index)
  loops.forEach((link, rank) => {
    link.rank = rank
  })

  const slots = orderSlots(initial, !!options.priority)
  assignPorts(slots)
  return { links, loops, maxColumn, nodes, slots }
}

/**
 * The flows of a slot edge are ordered by where their other end is in the
 * neighbouring column, so they do not cross each other on the way out. Back
 * flows come last, the ones of the outermost lane first so that their turns
 * do not cross, then by their other end.
 */
function assignPorts(slots: PlanSlot[][]) {
  const by = (slot: PlanSlot, end: 'in' | 'out') => {
    const other = (link: PlanLink) =>
      link.path[pathIndex(link, slot, end) + (end === 'in' ? -1 : 1)].row
    return (a: PlanLink, b: PlanLink) =>
      Number(a.back) - Number(b.back) ||
      (b.rank ?? -1) - (a.rank ?? -1) ||
      other(a) - other(b) ||
      a.index - b.index
  }
  for (const slot of slots.flat()) {
    slot.in.sort(by(slot, 'in'))
    slot.out.sort(by(slot, 'out'))
  }
}
