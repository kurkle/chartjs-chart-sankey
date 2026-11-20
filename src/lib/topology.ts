import type { SankeyControllerDatasetOptions, SankeyDataPoint, SankeyNode } from '../types.js'
import type { OrderGraph } from './order.js'

import { buildNodesFromData } from './core.js'
import { orderSlots } from './order.js'

/**
 * A place in a column: a node, or a waypoint of a flow that skips the column
 * (a virtual slot of the size of the flow, which belongs to that flow alone and
 * is never drawn as a node).
 */
export interface PlanSlot {
  readonly kind: 'node' | 'waypoint'
  /** The key of the node, or `<flow index>@<column>` for a waypoint */
  readonly key: string
  readonly column: number
  /** Size in flow units */
  readonly size: number
  /** The node, for a real slot */
  readonly node?: SankeyNode
  /** The flow, for a waypoint */
  readonly link?: PlanLink
  /** Flows arriving at the slot, in the order they meet its entry edge */
  readonly in: readonly PlanLink[]
  /** Flows leaving the slot, in the order they meet its exit edge */
  readonly out: readonly PlanLink[]
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
   * Position of a back flow in the nesting order of the loops (shortest span
   * first, equal spans in data order); -1 for flows without a lane
   */
  readonly lane: number
  /**
   * The slots the flow passes: its source, a waypoint in every column it
   * skips, its target. A back flow has just its two ends.
   */
  readonly path: readonly PlanSlot[]
}

/**
 * The columns a back flow runs under: from its target column to its source
 * column (a flow to its own node: that column). A loop takes room in each of
 * them, but it is not part of their content.
 */
export interface PlanLane {
  readonly link: PlanLink
  /** The leftmost column (the target's) and the rightmost one (the source's) */
  readonly first: number
  readonly last: number
}

/**
 * Everything about a chart that does not depend on its size: no pixels and no
 * positions. The nodes' `x` holds their column.
 */
export interface Plan {
  readonly nodes: ReadonlyMap<string, SankeyNode>
  readonly links: readonly PlanLink[]
  /** Slots of each column in drawing order, waypoints included; empty columns too */
  readonly slots: readonly (readonly PlanSlot[])[]
  /** Nodes of each column in drawing order */
  readonly columns: readonly (readonly SankeyNode[])[]
  /** The slot of every node, by key */
  readonly slotOf: ReadonlyMap<string, PlanSlot>
  readonly maxColumn: number
  /** Lanes of the back flows in nesting order, shortest span first */
  readonly lanes: readonly PlanLane[]
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

  const isBack = drafts.map(
    (draft, index) =>
      closers.has(index) || draft.from === draft.to || columnOf[draft.to] <= columnOf[draft.from]
  )
  return layOut(nodeList, drafts, isBack, columnOf, maxColumn, nodes, options)
}

interface MutableSlot {
  key: string
  column: number
  size: number
  kind: 'node' | 'waypoint'
  node?: SankeyNode
  link?: MutableLink
  in: MutableLink[]
  out: MutableLink[]
  id: number
}

interface MutableLink {
  index: number
  flow: number
  from: SankeyNode
  to: SankeyNode
  back: boolean
  lane: number
  path: MutableSlot[]
}

/**
 * Slots, their order and the ports: every flow that skips columns gets a
 * waypoint in each of them, and the order within a column is worked out over
 * the nodes and the waypoints together.
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
  const create = (slot: Omit<MutableSlot, 'id' | 'in' | 'out'>) => {
    const made: MutableSlot = { ...slot, id: all.length, in: [], out: [] }
    all.push(made)
    return made
  }
  const real = nodeList.map((node) =>
    create({ column: node.x ?? 0, key: node.key, kind: 'node', node, size: node.size })
  )

  // Loops in nesting order: the shortest span first, so that nested loops do
  // not cross. An empty flow has nothing to draw, so it gets no lane.
  const looping = drafts
    .map((draft, index) => ({ draft, index }))
    .filter(({ draft, index }) => isBack[index] && draft.flow > 0)
    .sort(
      (a, b) =>
        columnOf[a.draft.from] -
          columnOf[a.draft.to] -
          (columnOf[b.draft.from] - columnOf[b.draft.to]) || a.index - b.index
    )
  const laneOf = new Map(looping.map(({ index }, rank) => [index, rank]))
  const links: MutableLink[] = drafts.map((draft, index) => {
    const link: MutableLink = {
      back: isBack[index],
      flow: draft.flow,
      from: nodeList[draft.from],
      index,
      lane: laneOf.get(index) ?? -1,
      path: [],
      to: nodeList[draft.to],
    }
    link.path.push(real[draft.from])
    if (!isBack[index]) {
      for (let c = columnOf[draft.from] + 1; c < columnOf[draft.to]; c++) {
        link.path.push(
          create({ column: c, key: `${index}@${c}`, kind: 'waypoint', link, size: draft.flow })
        )
      }
    }
    link.path.push(real[draft.to])
    return link
  })

  const order = orderSlots(buildGraph(all, links, maxColumn, options))
  const lanes = collectLanes(links, columnOf, drafts)
  const position = new Map<MutableSlot, number>()
  const slots = order.map((ids) => ids.map((id) => all[id]))
  slots.forEach((column) => {
    column.forEach((slot, i) => {
      position.set(slot, i)
    })
  })

  assignPorts(all, links, position)

  const freeze = <T extends object>(list: T[]) => Object.freeze(list)
  for (const slot of all) {
    freeze(slot.in)
    freeze(slot.out)
    Object.freeze(slot)
  }
  for (const link of links) {
    freeze(link.path)
    Object.freeze(link)
  }
  const frozenSlots = slots.map((column) => freeze([...column]))
  return Object.freeze({
    columns: freeze(
      frozenSlots.map((column) => freeze(column.flatMap((slot) => (slot.node ? [slot.node] : []))))
    ),
    lanes,
    links: freeze(links),
    maxColumn,
    nodes,
    slotOf: new Map(real.map((slot) => [slot.key, slot])),
    slots: freeze(frozenSlots),
  }) as unknown as Plan
}

function collectLanes(
  links: MutableLink[],
  columnOf: number[],
  drafts: PlanLinkDraft[]
): readonly PlanLane[] {
  const routed = links.filter((link) => link.lane >= 0).sort((a, b) => a.lane - b.lane)
  return Object.freeze(
    routed.map((link) => {
      const to = columnOf[drafts[link.index].to]
      const from = columnOf[drafts[link.index].from]
      return Object.freeze({
        first: to,
        last: from,
        link: link as unknown as PlanLink,
      })
    })
  )
}

/**
 * The graph the order is worked out on: slots by id, the flows that go forward
 * between neighbouring columns as edges. The initial order lists the slots of
 * each column as the data first mentions them.
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
  for (const link of links) {
    link.path.forEach((slot, i) => {
      if (!seen.has(slot.id)) {
        seen.add(slot.id)
        columns[slot.column].push(slot.id)
      }
      const next = link.path[i + 1]
      if (!link.back && next) {
        downs[slot.id].push([next.id, link.flow])
        ups[next.id].push([slot.id, link.flow])
      }
    })
  }
  const rank = all.map((slot) =>
    options.priority && slot.node ? (slot.node.priority ?? 0) : undefined
  )
  // The ends of the back flows that have a lane
  const stubs = links.flatMap((link) =>
    link.lane < 0
      ? []
      : [
          {
            column: link.path[0].column,
            end: 'out' as const,
            id: link.path[0].id,
            weight: link.flow,
          },
          {
            column: (link.path.at(-1) as MutableSlot).column,
            end: 'in' as const,
            id: (link.path.at(-1) as MutableSlot).id,
            weight: link.flow,
          },
        ]
  )
  return { columns, downs, rank, stubs, ups }
}

/**
 * The flows of a slot edge are ordered by where their other end is in the
 * neighbouring column, so they do not cross each other on the way out. Back
 * flows come last, the ones of the outermost lane first so that their turns
 * do not cross, then by their other end.
 */
function assignPorts(all: MutableSlot[], links: MutableLink[], position: Map<MutableSlot, number>) {
  for (const link of links) {
    const { path } = link
    path[0].out.push(link)
    ;(path.at(-1) as MutableSlot).in.push(link)
    for (let i = 1; i < path.length - 1; i++) {
      path[i].in.push(link)
      path[i].out.push(link)
    }
  }
  const opposite = (link: MutableLink, slot: MutableSlot, end: 'in' | 'out') =>
    end === 'in'
      ? link.path[link.path.lastIndexOf(slot) - 1]
      : link.path[link.path.indexOf(slot) + 1]
  const by = (slot: MutableSlot, end: 'in' | 'out') => (a: MutableLink, b: MutableLink) =>
    Number(a.back) - Number(b.back) ||
    b.lane - a.lane ||
    (position.get(opposite(a, slot, end)) ?? 0) - (position.get(opposite(b, slot, end)) ?? 0) ||
    a.index - b.index
  for (const slot of all) {
    slot.in.sort(by(slot, 'in'))
    slot.out.sort(by(slot, 'out'))
  }
}
