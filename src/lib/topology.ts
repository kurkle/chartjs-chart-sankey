import type { SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode } from '../types.js'
import type { OrderGraph } from './order.js'

import { buildNodesFromData } from './core.js'
import { orderSlots } from './order.js'

/** The side of a slot a flow meets it on: the edge towards the previous column or towards the next. */
export type Side = 'left' | 'right'

/**
 * A place in a column: a node, a waypoint of a forward flow that skips the
 * column, or a loop slot of a back flow that runs past it (a virtual slot of
 * the size of the flow, which belongs to that flow alone and is never drawn as
 * a node).
 */
export interface PlanSlot {
  readonly kind: 'node' | 'waypoint' | 'loop'
  /** The key of the node, or `<flow index>@<column>` for a waypoint or a loop slot */
  readonly key: string
  readonly column: number
  /** Size in flow units */
  readonly size: number
  /** The node, for a real slot */
  readonly node?: SankeyNode
  /** The flow, for a waypoint or a loop slot */
  readonly link?: PlanLink
  /** Flows that meet the edge towards the previous column, in the order they meet it */
  readonly left: readonly PlanStop[]
  /** Flows that meet the edge towards the next column, in the order they meet it */
  readonly right: readonly PlanStop[]
}

/** A flow at a slot of its path. */
export interface PlanStop {
  readonly link: PlanLink
  /** Place of the slot in the path of the flow */
  readonly at: number
}

export interface PlanLink {
  /** Index of the flow in the dataset */
  readonly index: number
  readonly flow: number
  readonly from: SankeyNode
  readonly to: SankeyNode
  /** The flow does not run from an earlier column to a later one */
  readonly back: boolean
  /**
   * The slots the flow passes, in the order it runs through them. A forward
   * flow has its source, a waypoint in every column it skips and its target.
   * A back flow has its source, a loop slot in its source column, in every
   * column between and in its target column (just one for a flow to its own
   * node), and its target. An empty back flow has just its two ends.
   */
  readonly path: readonly PlanSlot[]
}

/**
 * The band of a back flow between a node and its loop slot in the same column:
 * it leaves the node edge, turns in the gap beside the column and returns to the
 * slot (the hook at the target end is the mirror image, before the column).
 */
export interface PlanHook {
  readonly link: PlanLink
  readonly node: PlanSlot
  readonly slot: PlanSlot
  /** The gap the hook turns in: after the column (the source end) or before it (the target end) */
  readonly side: Side
  readonly column: number
}

/**
 * Everything about a chart that does not depend on its size: no pixels and no
 * positions. The nodes' `x` holds their column.
 */
export interface Plan {
  readonly nodes: ReadonlyMap<string, SankeyNode>
  readonly links: readonly PlanLink[]
  /** Slots of each column in drawing order, waypoints and loop slots included; empty columns too */
  readonly slots: readonly (readonly PlanSlot[])[]
  /** Nodes of each column in drawing order */
  readonly columns: readonly (readonly SankeyNode[])[]
  /** The slot of every node, by key */
  readonly nodeSlots: ReadonlyMap<string, PlanSlot>
  readonly maxColumn: number
  /** The turns of the back flows beside the columns */
  readonly hooks: readonly PlanHook[]
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
  const order = links.map((_, i) => i).sort((a, b) => num(links[b].flow) - num(links[a].flow))
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
  const queue = missing.flatMap((count, i) => (count ? [] : [i]))
  // the queue grows while it is walked
  for (const current of queue) {
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

  // A flow is a back flow when it does not run to a later column. A flow that closes a cycle
  // is one too, unless pinned columns put its target after its source: then it runs forward.
  const isBack = drafts.map((draft) => columnOf[draft.to] <= columnOf[draft.from])
  return layOut(nodeList, drafts, isBack, columnOf, maxColumn, nodes, options)
}

/**
 * The sides a flow meets the slot at place `at` of its path on: the one it
 * arrives at and the one it leaves by (none for the source and the target
 * respectively). A forward flow arrives on the left and leaves on the right; a
 * back flow leaves its source on the right, runs through its loop slots from
 * right to left, and arrives at its target on the left.
 */
export function sidesOf(link: PlanLink, at: number): { arrive?: Side; leave?: Side } {
  const last = link.path.length - 1
  const arrive = link.back && at < last ? 'right' : 'left'
  const leave = link.back && at > 0 ? 'left' : 'right'
  return { arrive: at === 0 ? undefined : arrive, leave: at === last ? undefined : leave }
}

// The plan is built mutable and frozen at the end; the shapes only differ in
// being writable (and in the id the order is worked out with).
type Writable<T> = { -readonly [K in keyof T]: T[K] }

interface MutableSlot extends Writable<PlanSlot> {
  id: number
  link?: MutableLink
  left: PlanStop[]
  right: PlanStop[]
}

interface MutableLink extends Writable<PlanLink> {
  path: MutableSlot[]
}

/**
 * Slots, their order and the ports: every flow that skips columns gets a
 * waypoint in each of them and every back flow a loop slot in each column it
 * runs past, and the order within a column is worked out over the nodes, the
 * waypoints and the loop slots together.
 */
function layOut(
  nodeList: SankeyNode[],
  drafts: PlanLinkDraft[],
  isBack: boolean[],
  columnOf: number[],
  maxColumn: number,
  nodes: Map<string, SankeyNode>,
  options: TopologyOptions
): Plan {
  const all: MutableSlot[] = []
  const create = (slot: Omit<MutableSlot, 'id' | 'left' | 'right'>) => {
    const made: MutableSlot = { ...slot, id: all.length, left: [], right: [] }
    all.push(made)
    return made
  }
  const real = nodeList.map((node) =>
    create({ column: node.x ?? 0, key: node.key, kind: 'node', node, size: node.size })
  )

  const links: MutableLink[] = drafts.map((draft, index) => {
    const link: MutableLink = {
      back: isBack[index],
      flow: draft.flow,
      from: nodeList[draft.from],
      index,
      path: [],
      to: nodeList[draft.to],
    }
    const first = columnOf[draft.from]
    const last = columnOf[draft.to]
    const add = (c: number, kind: 'loop' | 'waypoint') =>
      link.path.push(create({ column: c, key: `${index}@${c}`, kind, link, size: draft.flow }))
    link.path.push(real[draft.from])
    if (!isBack[index]) {
      for (let c = first + 1; c < last; c++) add(c, 'waypoint')
    } else if (draft.flow > 0) {
      for (let c = first; c >= last; c--) add(c, 'loop')
    }
    link.path.push(real[draft.to])
    return link
  })

  const order = orderSlots(buildGraph(all, links, maxColumn, options))
  const position = new Map<MutableSlot, number>()
  const slots = order.map((ids) => ids.map((id) => all[id]))
  for (const column of slots) {
    column.forEach((slot, i) => {
      position.set(slot, i)
    })
  }

  const hooks = hooksOf(links)
  assignPorts(all, links, position)

  // Freeze it all
  for (const slot of all) {
    Object.freeze(slot.left)
    Object.freeze(slot.right)
    Object.freeze(slot)
  }
  for (const link of links) {
    Object.freeze(link.path)
    Object.freeze(link)
  }
  for (const hook of hooks) Object.freeze(hook)
  const frozenSlots = slots.map((column) => Object.freeze([...column]))
  return Object.freeze({
    columns: Object.freeze(
      frozenSlots.map((column) =>
        Object.freeze(column.flatMap((slot) => (slot.node ? [slot.node] : [])))
      )
    ),
    hooks: Object.freeze(hooks),
    links: Object.freeze(links),
    maxColumn,
    nodeSlots: new Map(real.map((slot) => [slot.key, slot])),
    nodes,
    slots: Object.freeze(frozenSlots),
  })
}

/** The two hooks of every back flow that has loop slots. */
function hooksOf(links: MutableLink[]): MutableHook[] {
  return links.flatMap((link) => {
    const { path } = link
    if (!link.back || path.length < 3) return []
    const source = path[0]
    const first = path[1]
    const last = path.at(-2) as MutableSlot
    const target = path.at(-1) as MutableSlot
    return [
      { column: source.column, link, node: source, side: 'right' as const, slot: first },
      { column: target.column, link, node: target, side: 'left' as const, slot: last },
    ]
  })
}

interface MutableHook extends Writable<PlanHook> {
  link: MutableLink
  node: MutableSlot
  slot: MutableSlot
}

/** Where the kinds of slot start in a column: waypoints above the nodes, loop slots below. */
const KIND_RANK = { loop: 2, node: 1, waypoint: 0 }

/**
 * The graph the order is worked out on: slots by id, the flows between
 * neighbouring columns as edges (the chain of loop slots of a back flow too)
 * and the hooks between a node and its loop slot. The initial order lists the
 * slots of each column as the data first mentions them.
 */
function buildGraph(
  all: MutableSlot[],
  links: MutableLink[],
  maxColumn: number,
  options: TopologyOptions
): OrderGraph {
  const columns: number[][] = Array.from({ length: maxColumn + 1 }, () => [])
  const seen = new Set<number>()
  const ups: Array<Array<[number, number]>> = all.map(() => [])
  const downs: Array<Array<[number, number]>> = all.map(() => [])
  const span = new Map<number, number>()
  for (const link of links) {
    link.path.forEach((slot, i) => {
      if (!seen.has(slot.id)) {
        seen.add(slot.id)
        columns[slot.column].push(slot.id)
      }
      if (slot.kind === 'loop') span.set(slot.id, link.path.length)
      const next = link.path[i + 1]
      if (next && next.column !== slot.column) {
        // the edge joins the slots of two neighbouring columns, whichever way the flow runs
        const [before, after] = slot.column < next.column ? [slot, next] : [next, slot]
        downs[before.id].push([after.id, link.flow])
        ups[after.id].push([before.id, link.flow])
      }
    })
  }
  // Waypoints start above the nodes of their column: a flow that skips columns runs along
  // the outside, and only moves inwards where that removes crossings. Loop slots start
  // below the nodes, the shortest loops first so that nested loops start nested.
  for (const column of columns) {
    column.sort(
      (a, b) =>
        KIND_RANK[all[a].kind] - KIND_RANK[all[b].kind] || (span.get(a) ?? 0) - (span.get(b) ?? 0)
    )
  }
  const rank = all.map((slot) =>
    options.priority && slot.node ? (slot.node.priority ?? 0) : undefined
  )
  const hooks = hooksOf(links).map((hook) => ({
    a: hook.node.id,
    b: hook.slot.id,
    column: hook.column,
    side: hook.side,
    weight: hook.link.flow,
  }))
  const ties: Array<Array<[number, number]>> = all.map(() => [])
  const chains: number[][] = []
  const tie = (x: MutableSlot, y: MutableSlot, flow: number) => {
    ties[x.id].push([y.id, flow])
    ties[y.id].push([x.id, flow])
  }
  for (const link of [...links].sort(
    (x, y) => x.path.length - y.path.length || x.index - y.index
  )) {
    if (!link.back || link.path.length < 3) continue
    link.path.slice(0, -1).forEach((slot, i) => {
      tie(slot, link.path[i + 1], link.flow)
    })
    chains.push(link.path.slice(1, -1).map((slot) => slot.id))
  }
  return {
    chains,
    columns,
    downs,
    hooks,
    loop: all.map((slot) => slot.kind === 'loop'),
    rank,
    size: all.map((slot) => slot.size),
    ties,
    ups,
  }
}

/**
 * The flows of a slot edge are ordered by where their other end is in the
 * neighbouring column, so they do not cross each other on the way out. The
 * hooks of a node edge go to its ends, so that they do not cross the flows
 * between the columns: the hooks to loop slots above the node first and the
 * ones to slots below it last, with the nearest slot first in each group, which
 * makes them nest.
 */
function assignPorts(all: MutableSlot[], links: MutableLink[], position: Map<MutableSlot, number>) {
  for (const link of links) {
    link.path.forEach((slot, at) => {
      const { arrive, leave } = sidesOf(link, at)
      if (arrive) slot[arrive].push({ at, link })
      if (leave) slot[leave].push({ at, link })
    })
  }
  for (const slot of all) {
    const mine = position.get(slot) ?? 0
    const key = ({ at, link }: PlanStop) => {
      const other = link.path[sidesOf(link, at).arrive ? at - 1 : at + 1]
      const towards = position.get(other as MutableSlot) ?? 0
      // a hook is in the group of the slot it goes to: above (-1) or below (1) the node, not between
      return other.column === slot.column
        ? { group: towards < mine ? -1 : 1, towards: -towards }
        : { group: 0, towards }
    }
    const by = (a: PlanStop, b: PlanStop) => {
      const [ka, kb] = [key(a), key(b)]
      return ka.group - kb.group || ka.towards - kb.towards || a.link.index - b.link.index
    }
    slot.left.sort(by)
    slot.right.sort(by)
  }
}
