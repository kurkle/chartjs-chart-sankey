import type { SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode } from '../types.js'

import { buildNodesFromData } from './core.js'
import { buildLoops } from './lane-space.js'
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
  /** What the back flows that share a lane have in common: their target, or the flow itself */
  lane?: object
  /** The lane of a back flow runs before the content on the cross axis, not after it */
  top?: boolean
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
  'backFlows' | 'column' | 'modeX' | 'priority' | 'size'
>

const num = (value: number) => (Number.isFinite(value) ? value : 0)

/** What the flows between the same two nodes, by their keys, have in common. */
const pairKey = (from: string, to: string) => JSON.stringify([from, to])

/**
 * The key of every flow, in data order: its two nodes and its place among the
 * flows between them. A flow keeps its element by this key when the data is
 * replaced.
 */
export function flowKeys(links: PlanLink[]): string[] {
  const seen = new Map<string, number>()
  return links.map(({ from, to }) => {
    const pair = pairKey(from.key, to.key)
    const place = seen.get(pair) ?? 0
    seen.set(pair, place + 1)
    return `${pair}#${place}`
  })
}

/**
 * Picks the flows that close a cycle. The flows between the same two nodes go
 * together, and are accepted from the largest total to the smallest (data order
 * breaks ties); one that would close a cycle with the ones already accepted is
 * a back flow. Self flows are always back flows.
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
  const pair = new Map<string, number>()
  const keyOf = (i: number) => pairKey(data[i].from, data[i].to)
  for (const [i, d] of data.entries()) pair.set(keyOf(i), (pair.get(keyOf(i)) ?? 0) + num(d.flow))
  const bySize = data
    .map((_, i) => i)
    .sort((a, b) => (pair.get(keyOf(b)) as number) - (pair.get(keyOf(a)) as number) || a - b)
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
  const { bundle = 'pair', side = 'end' } = options.backFlows ?? {}
  // the flows between two nodes share a lane, or with 'target' all back flows to a node
  const pairs = new Map<string, object>()
  const laneOf = (link: PlanLink) => {
    if (bundle === 'target') return link.to
    if (bundle === 'source') return link.from
    const key = pairKey(link.from.key, link.to.key)
    pairs.set(key, pairs.get(key) ?? link)
    return pairs.get(key) as object
  }
  for (const link of loops) {
    link.lane = bundle && link.from !== link.to ? laneOf(link) : link
    link.top = side === 'start'
  }
  // the ranks, for the ports
  buildLoops({ loops } as Plan)

  // With the side left open, the order is found without the lanes first, the
  // sides are chosen from it, and the order is found again with them.
  const ranked = !!options.priority
  const auto = side === 'auto'
  let slots = orderSlots(initial, ranked, !auto)
  if (auto) {
    chooseSides(loops, slots)
    slots = orderSlots(slots, ranked)
    chooseSides(loops, slots)
  }
  assignPorts(slots)
  return { links, loops, maxColumn, nodes, slots }
}

/**
 * A lane runs on the side of the cross axis nearer to the ends of its back
 * flows, by where they sit in their columns weighed by flow. A loop within one
 * column goes round the side of its target, so it does not cross the source.
 */
function chooseSides(loops: PlanLink[], slots: PlanSlot[][]) {
  const mid = new Map<PlanSlot, number>()
  for (const column of slots) {
    const total = column.reduce((sum, slot) => sum + slot.size, 0) || 1
    let before = 0
    for (const slot of column) {
      mid.set(slot, (before + slot.size / 2) / total)
      before += slot.size
    }
  }
  const where = (slot: PlanSlot) => mid.get(slot) as number
  const lanes = new Map<object | undefined, PlanLink[]>()
  for (const link of loops) lanes.set(link.lane, [...(lanes.get(link.lane) ?? []), link])
  for (const members of lanes.values()) {
    let sum = 0
    let weight = 0
    for (const { flow, path } of members) {
      sum += flow * (where(path[0]) + where(path[1]))
      weight += 2 * flow
    }
    const level = members.find((m) => m.from !== m.to && m.from.x === m.to.x)
    const top = level ? where(level.path[1]) < where(level.path[0]) : sum < weight / 2
    for (const m of members) m.top = top
  }
}

/**
 * The flows of a slot edge are ordered by where their other end is in the
 * neighbouring column, so they do not cross each other on the way out. Back
 * flows come last, the ones of the outermost lane first so that their turns
 * do not cross, then by their other end; those of a lane before the content
 * come first instead, the ones of the innermost lane first.
 */
function assignPorts(slots: PlanSlot[][]) {
  const side = (link: PlanLink) => {
    if (!link.back) return 0
    return link.top ? -1 : 1
  }
  const by = (slot: PlanSlot, end: 'in' | 'out') => {
    const other = (link: PlanLink) =>
      link.path[pathIndex(link, slot, end) + (end === 'in' ? -1 : 1)].row
    return (a: PlanLink, b: PlanLink) =>
      side(a) - side(b) ||
      (a.top ? (a.rank ?? -1) - (b.rank ?? -1) : (b.rank ?? -1) - (a.rank ?? -1)) ||
      other(a) - other(b) ||
      a.index - b.index
  }
  for (const slot of slots.flat()) {
    slot.in.sort(by(slot, 'in'))
    slot.out.sort(by(slot, 'out'))
  }
}
