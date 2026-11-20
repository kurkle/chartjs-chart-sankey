import { ROUNDS, SIDE_MARGIN, TRANSPOSE_PASSES } from './constants.js'

/** Differences in the weight of the crossings below this are rounding. */
const EPSILON = 1e-9

/**
 * Order of the slots (the nodes and the waypoints of the flows that skip
 * columns) within each column. The graph is layered, so the order is chosen
 * to keep the flows between neighbouring columns from crossing: start from a
 * given order, then sweep forward and backward moving every slot towards the
 * flow-weighted mean position of its neighbours, swap neighbours that lower the
 * crossings, and keep the order with the fewest. A crossing weighs the smaller
 * of the two flows, so a hairline crossing a thick band costs little and two
 * thick bands cost a lot. Ties keep the earlier order, so the result is stable.
 */

/** A neighbour in the adjacent column and the flow shared with it. */
export type Neighbour = readonly [id: number, flow: number]

/**
 * The turn of a back flow beside a column, between a node `a` and the slot `b`
 * the flow has in the same column. The band leaves the node edge, turns in the
 * gap on the `side`, and comes back to the slot, so it crosses every band of
 * that gap that meets a slot between the two.
 */
export interface Hook {
  column: number
  side: 'left' | 'right'
  /** Slot ids of the node and of the loop slot */
  a: number
  b: number
  /** Flow of the back flow */
  weight: number
}

export interface OrderGraph {
  /** Initial order: the ids of the slots of each column. */
  columns: readonly (readonly number[])[]
  /** Neighbours in the previous column, by slot id. */
  ups: readonly (readonly Neighbour[])[]
  /** Neighbours in the next column, by slot id. */
  downs: readonly (readonly Neighbour[])[]
  /**
   * Rank of the slots whose relative order within their column is fixed (nodes
   * with a priority), by slot id; the others are moved around them.
   */
  rank: readonly (number | undefined)[]
  /** The turns of the back flows; they cross the bands that meet the slots between their ends */
  hooks: readonly Hook[]
  /** Size of the slots in flow units, by slot id */
  size: readonly number[]
  /** Whether the slot is a loop slot of a back flow, by slot id */
  loop: readonly boolean[]
  /**
   * For every slot, the slots its back flow travels to from it, with the flow: its loop slot
   * or its node across a turn, the loop slots of the neighbouring columns along the chain.
   */
  ties: readonly (readonly Neighbour[])[]
  /** The loop slots of each back flow, from its source column to its target column; shortest flows first */
  chains: readonly (readonly number[])[]
}

function positions(order: readonly (readonly number[])[], size: number): number[] {
  const pos = new Array<number>(size).fill(0)
  for (const column of order) {
    column.forEach((id, i) => {
      pos[id] = i
    })
  }
  return pos
}

/**
 * What an order costs: the weight of its crossings first and, among orders of
 * the same weight, how many crossings there are, so that a flow of no weight
 * (a thin or empty one) is still kept from crossing when that costs no weight.
 */
type Cost = readonly [weight: number, count: number, bend: number, length: number]

const same = (x: number, y: number, tolerance = EPSILON) =>
  Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(y))

/**
 * Whether the cost `a` is lower than `b`: by weight, by count when the weights
 * are equal and, when the crossings are the same, by the bend of the flows and the
 * length of the back flows (when a `margin` is given, only a difference of more than
 * that share of the cost counts).
 */
const cheaper = (a: Cost, b: Cost, margin = 0) => {
  if (!same(a[0], b[0])) return a[0] < b[0]
  if (a[1] !== b[1]) return a[1] < b[1]
  const tolerance = Math.max(EPSILON, margin)
  if (!same(a[2], b[2], tolerance)) return a[2] < b[2]
  return !same(a[3], b[3], tolerance) && a[3] < b[3]
}

/**
 * Weight of the pairs of edges between two columns that cross, each pair
 * weighing the smaller of its two flows. A crossing pair is made of an edge
 * and a heavier one, so the edges are taken from the heaviest down and each
 * adds its flow once for every already taken edge it crosses.
 */
function weightedCrossings(edges: readonly Edge[], sources: number, targets: number): Cost {
  if (edges.length < 2) return [0, 0, 0, 0]
  const taken = new TakenEdges(sources, targets)
  let weight = 0
  let count = 0
  for (const [from, to, flow] of [...edges].sort((a, b) => b[2] - a[2])) {
    const crossing = taken.crossing(from + 1, to + 1)
    weight += flow * crossing
    count += crossing
    taken.add(from + 1, to + 1)
  }
  return [weight, count, 0, 0]
}

/** Counts of the taken edges by (start, end), added up in two dimensions (positions from 1). */
class TakenEdges {
  private readonly tree: Int32Array
  private readonly width: number

  constructor(
    private readonly sources: number,
    private readonly targets: number
  ) {
    this.width = targets + 1
    this.tree = new Int32Array((sources + 1) * this.width)
  }

  /** How many taken edges start at or before `s` and end at or before `t`. */
  private prefix(s: number, t: number) {
    let count = 0
    for (let i = s; i > 0; i -= i & -i) {
      for (let j = t; j > 0; j -= j & -j) count += this.tree[i * this.width + j]
    }
    return count
  }

  /** How many taken edges started before and end after, or started after and end before. */
  crossing(s: number, t: number) {
    return (
      this.prefix(s - 1, this.targets) -
      this.prefix(s - 1, t) +
      this.prefix(this.sources, t - 1) -
      this.prefix(s, t - 1)
    )
  }

  add(s: number, t: number) {
    for (let i = s; i <= this.sources; i += i & -i) {
      for (let j = t; j <= this.targets; j += j & -j) this.tree[i * this.width + j]++
    }
  }
}

/** A band between two neighbouring columns: where it starts, where it ends and its flow. */
type Edge = readonly [from: number, to: number, flow: number]

/** The bands between a column and the next, by where they start and end. */
function bandsOfGap(
  order: readonly (readonly number[])[],
  downs: OrderGraph['downs'],
  c: number,
  pos: number[]
) {
  const edges: Edge[] = []
  for (const id of order[c]) {
    for (const [other, flow] of downs[id]) {
      edges.push([pos[id], pos[other], flow])
    }
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return edges
}

/** The positions a hook spans in its column: the lower and the upper one. */
function spanOf(hook: Hook, pos: ArrayLike<number>): [number, number] {
  const [x, y] = [pos[hook.a], pos[hook.b]]
  return x < y ? [x, y] : [y, x]
}

/** Whether two turns beside the same column cross: their spans overlap without one holding the other. */
function interleave([lo1, hi1]: [number, number], [lo2, hi2]: [number, number]) {
  return (lo1 < lo2 && lo2 < hi1 && hi1 < hi2) || (lo2 < lo1 && lo1 < hi2 && hi2 < hi1)
}

/**
 * The cost of the crossings between the flows of neighbouring columns, and of
 * the turns of the back flows: a turn weighs the smaller of its flow and the
 * flow of every band it crosses, and of every turn beside the same column it
 * interleaves with.
 */
function crossingCost(order: readonly (readonly number[])[], graph: OrderGraph): Cost {
  const { downs, hooks } = graph
  const pos = positions(order, downs.length)
  // the turns beside each edge of each column: the gap after a column or the one before it
  const byEdge = new Map<number, Hook[]>()
  for (const hook of hooks) {
    const key = hook.column * 2 + Number(hook.side === 'right')
    byEdge.set(key, [...(byEdge.get(key) ?? []), hook])
  }

  let weight = 0
  let count = 0
  const add = ([w, n]: Cost) => {
    weight += w
    count += n
  }
  for (let c = 0; c < order.length - 1; c++) {
    const edges = bandsOfGap(order, downs, c, pos)
    add(weightedCrossings(edges, order[c].length, order[c + 1].length))
    for (const hook of byEdge.get(c * 2 + 1) ?? []) add(hookCrossings(hook, edges, pos, 0))
    for (const hook of byEdge.get((c + 1) * 2) ?? []) add(hookCrossings(hook, edges, pos, 1))
  }
  for (const list of byEdge.values()) add(interleavings(list, pos))
  return [weight, count, ...routeLength(order, graph)]
}

/** The weight of the crossings of an order. */
export const countCrossings = (order: readonly (readonly number[])[], graph: OrderGraph): number =>
  crossingCost(order, graph)[0]

/** Where the slots are across their column, in flow units: the middle of each, the slots packed. */
function centresOf(order: readonly (readonly number[])[], size: readonly number[]): number[] {
  const centre = new Array<number>(size.length).fill(0)
  for (const column of order) {
    let start = 0
    for (const id of column) {
      centre[id] = start + size[id] / 2
      start += size[id]
    }
  }
  return centre
}

/**
 * How far the flows travel across the columns, each times its flow, with the slots
 * taken packed: the bend of the flows between neighbouring columns, and the route of
 * the back flows between the slots they tie (a turn, a step along the chain). The bend
 * of the flows that are not loops counts first, so that a loop is moved to the other side
 * of the nodes only where it does not put a bend in the flows of the columns it pushes
 * the nodes down in (loop slots, which the placement can move freely, are not counted).
 * Without back flows there is nothing to judge, and the bend is left out.
 */
export function routeLength(
  order: readonly (readonly number[])[],
  graph: OrderGraph
): [bend: number, route: number] {
  const centre = centresOf(order, graph.size)
  // the flows meet the slots at their start, not at their middle, so that is where the bend is taken
  const top = (id: number, at: number) => at - graph.size[id] / 2
  let bend = 0
  let route = 0
  graph.ties.forEach((partners, id) => {
    for (const [other, flow] of partners) {
      if (other > id) route += flow * Math.abs(centre[id] - centre[other])
    }
  })
  graph.downs.forEach((partners, id) => {
    if (graph.loop[id] || !graph.chains.length) return
    for (const [other, flow] of partners) {
      bend += flow * Math.abs(top(id, centre[id]) - top(other, centre[other]))
    }
  })
  return [bend, route]
}

/** The bands of a gap that meet a slot strictly between the ends of a hook, as weight and count. */
function hookCrossings(
  hook: Hook,
  edges: readonly Edge[],
  pos: ArrayLike<number>,
  end: 0 | 1
): Cost {
  const [lo, hi] = spanOf(hook, pos)
  let weight = 0
  let count = 0
  for (const edge of edges) {
    if (edge[end] > lo && edge[end] < hi) {
      weight += Math.min(hook.weight, edge[2])
      count++
    }
  }
  return [weight, count, 0, 0]
}

/** The turns of a list that cross each other, as weight and count. */
function interleavings(list: readonly Hook[], pos: ArrayLike<number>): Cost {
  let weight = 0
  let count = 0
  const spans = list.map((hook) => spanOf(hook, pos))
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (interleave(spans[i], spans[j])) {
        weight += Math.min(list[i].weight, list[j].weight)
        count++
      }
    }
  }
  return [weight, count, 0, 0]
}

/** Puts the slots with a rank back in rank order, keeping the places they occupy. */
function keepRanks(ids: number[], rank: OrderGraph['rank']): number[] {
  const places = ids.flatMap((id, i) => (rank[id] === undefined ? [] : [i]))
  const ranked = places.map((i) => ids[i])
  const sorted = [...ranked].sort(
    (a, b) => (rank[a] as number) - (rank[b] as number) || ranked.indexOf(a) - ranked.indexOf(b)
  )
  const result = [...ids]
  places.forEach((place, i) => {
    result[place] = sorted[i]
  })
  return result
}

/** The turns by the slot they end at, and by the edge of a column they turn beside. */
export interface HookIndex {
  at: Hook[][]
  group: Map<number, Hook[]>
}

const edgeKey = (hook: Hook) => hook.column * 2 + Number(hook.side === 'right')

export function indexHooks(graph: OrderGraph): HookIndex {
  const at: Hook[][] = graph.ups.map(() => [])
  const group = new Map<number, Hook[]>()
  for (const hook of graph.hooks) {
    at[hook.a].push(hook)
    at[hook.b].push(hook)
    group.set(edgeKey(hook), [...(group.get(edgeKey(hook)) ?? []), hook])
  }
  return { at, group }
}

function sweep(order: number[][], graph: OrderGraph, forward: boolean): number[][] {
  const result = order.map((column) => [...column])
  const pos = positions(result, graph.ups.length)
  const neighbours = forward ? graph.ups : graph.downs
  const first = forward ? 1 : result.length - 2
  const step = forward ? 1 : -1
  for (let c = first; c >= 0 && c < result.length; c += step) {
    const keyed = result[c].map((id, index) => {
      let sum = 0
      let weight = 0
      for (const [other, flow] of neighbours[id]) {
        sum += pos[other] * flow
        weight += flow
      }
      // slots whose flows weigh nothing follow the plain average of their neighbours
      if (!weight && neighbours[id].length) {
        const plain = neighbours[id].reduce((total, [other]) => total + pos[other], 0)
        return { id, index, mean: plain / neighbours[id].length }
      }
      return { id, index, mean: weight ? sum / weight : index }
    })
    keyed.sort((a, b) => a.mean - b.mean || a.index - b.index)
    result[c] = keepRanks(
      keyed.map((entry) => entry.id),
      graph.rank
    )
    result[c].forEach((id, i) => {
      pos[id] = i
    })
  }
  return result
}

type At = (id: number) => number

/** The positions a hook spans, with the ends read through `at`. */
function spanAt(hook: Hook, at: At): [number, number] {
  const [x, y] = [at(hook.a), at(hook.b)]
  return x < y ? [x, y] : [y, x]
}

/** The change in the weight of the bands a turn crosses when slot `other` (one of the two swapped) enters or leaves its span. */
function bandChange(hook: Hook, other: number, graph: OrderGraph, before: At, after: At): Cost {
  if (other === hook.a || other === hook.b) return [0, 0, 0, 0]
  const inside = (at: At) => {
    const [lo, hi] = spanAt(hook, at)
    return Number(at(other) > lo && at(other) < hi)
  }
  const change = inside(after) - inside(before)
  if (!change) return [0, 0, 0, 0]
  const bands = (hook.side === 'right' ? graph.downs : graph.ups)[other]
  return [
    change * bands.reduce((sum, [, flow]) => sum + Math.min(hook.weight, flow), 0),
    change * bands.length,
    0,
    0,
  ]
}

/** The change in the turns of an edge that a turn interleaves with: its weight and its count. */
function interleaveChange(hook: Hook, mates: readonly Hook[], before: At, after: At): Cost {
  let weight = 0
  let count = 0
  for (const mate of mates) {
    const change =
      Number(interleave(spanAt(hook, after), spanAt(mate, after))) -
      Number(interleave(spanAt(hook, before), spanAt(mate, before)))
    weight += change * Math.min(hook.weight, mate.weight)
    count += change
  }
  return [weight, count, 0, 0]
}

/**
 * What swapping two neighbouring slots changes in the weight of the turns of
 * the back flows. Of the turns that end at neither slot nothing changes, since
 * the two stay on the same side of everything else. Of a turn that ends at one
 * of them, the other slot may enter or leave the span it crosses the bands of,
 * and it may interleave with other turns of its edge differently.
 */
function hookDelta(a: number, b: number, graph: OrderGraph, index: HookIndex, pos: number[]): Cost {
  if (!index.at[a].length && !index.at[b].length) return [0, 0, 0, 0]
  const list = [...new Set([...index.at[a], ...index.at[b]])]
  const before: At = (id) => pos[id]
  const after: At = (id) => {
    if (id === a) return pos[b]
    return id === b ? pos[a] : pos[id]
  }
  let weight = 0
  let count = 0
  const add = ([w, n]: Cost) => {
    weight += w
    count += n
  }
  list.forEach((hook, i) => {
    add(bandChange(hook, a, graph, before, after))
    add(bandChange(hook, b, graph, before, after))
    // a pair of two turns that both end at the swapped slots is counted once
    const mates = (index.group.get(edgeKey(hook)) ?? []).filter((mate) => {
      const at = list.indexOf(mate)
      return mate !== hook && (at < 0 || at > i)
    })
    add(interleaveChange(hook, mates, before, after))
  })
  return [weight, count, 0, 0]
}

/** What swapping two neighbouring slots changes in the route of the back flows: only the ties of the two move. */
function tieDelta(a: number, b: number, graph: OrderGraph, centre: number[]): number {
  const [ca, cb] = swappedCentres(a, b, graph.size, centre)
  let route = 0
  for (const [id, now] of [
    [a, ca],
    [b, cb],
  ]) {
    for (const [other, flow] of graph.ties[id]) {
      if (other === a || other === b) continue
      route += flow * (Math.abs(now - centre[other]) - Math.abs(centre[id] - centre[other]))
    }
  }
  return route
}

/** The middles of two neighbouring slots after they swap, the first of them given first. */
function swappedCentres(a: number, b: number, size: readonly number[], centre: number[]) {
  const start = centre[a] - size[a] / 2
  return [start + size[b] + size[a] / 2, start + size[b] / 2] as const
}

/**
 * What swapping two neighbouring slots changes in the weight of the crossings:
 * only the pairs made of a band of the one and a band of the other change, in
 * the gap before the column and in the gap after it, and so do the turns of the
 * back flows beside the two.
 */
export function swapDelta(
  a: number,
  b: number,
  graph: OrderGraph,
  index: HookIndex,
  pos: number[],
  centre: number[],
  exact = true
): Cost {
  let weight = 0
  let count = 0
  for (const side of [graph.ups, graph.downs]) {
    for (const [x, wx] of side[a]) {
      for (const [y, wy] of side[b]) {
        const change = Number(pos[y] > pos[x]) - Number(pos[x] > pos[y])
        weight += Math.min(wx, wy) * change
        count += change
      }
    }
  }
  const [hw, hn] = hookDelta(a, b, graph, index, pos)
  // the route only decides when the crossings are the same; the bend of whole orders is judged apart
  if (!exact && (!same(weight + hw, 0) || count + hn !== 0)) return [weight + hw, count + hn, 0, 0]
  return [weight + hw, count + hn, 0, tieDelta(a, b, graph, centre)]
}

/** One pass over a column: swaps the neighbours that lower the weight; true when it swapped any. */
function transposeColumn(
  column: number[],
  graph: OrderGraph,
  index: HookIndex,
  pos: number[],
  centre: number[]
): boolean {
  let any = false
  for (let i = 0; i + 1 < column.length; i++) {
    const [a, b] = [column[i], column[i + 1]]
    if (graph.rank[a] !== undefined && graph.rank[b] !== undefined) continue
    if (cheaper(swapDelta(a, b, graph, index, pos, centre, false), [0, 0, 0, 0])) {
      ;[centre[a], centre[b]] = swappedCentres(a, b, graph.size, centre)
      column[i] = b
      column[i + 1] = a
      pos[a] = i + 1
      pos[b] = i
      any = true
    }
  }
  return any
}

/**
 * Swaps neighbouring slots of a column when that lowers the weight of the
 * crossings, a bounded number of passes over the columns. Slots with a rank
 * keep their order among themselves.
 */
function transpose(
  order: number[][],
  graph: OrderGraph,
  index: HookIndex,
  passes = TRANSPOSE_PASSES
): number[][] {
  const result = order.map((column) => [...column])
  const pos = positions(result, graph.ups.length)
  const centre = centresOf(result, graph.size)
  for (let pass = 0; pass < passes; pass++) {
    // every column is passed over, so no short circuit
    const done = result.map((column) => transposeColumn(column, graph, index, pos, centre))
    if (!done.includes(true)) break
  }
  return result
}

/**
 * The order with the loop slots of every back flow moved to the start of their
 * columns (the flows in `above`) or to the end of them (the others), around
 * the other slots, which keep their order. Nested loops stay nested: of the
 * loops on one side the shortest are nearest the other slots.
 */
function arrange(order: number[][], graph: OrderGraph, above: ReadonlySet<number>): number[][] {
  const chainOf = new Map<number, number>()
  graph.chains.forEach((chain, i) => {
    for (const id of chain) chainOf.set(id, i)
  })
  const rank = (id: number) => chainOf.get(id) as number
  return order.map((column) => {
    const loops = column.filter((id) => chainOf.has(id))
    const up = loops.filter((id) => above.has(rank(id))).sort((x, y) => rank(y) - rank(x))
    const down = loops.filter((id) => !above.has(rank(id))).sort((x, y) => rank(x) - rank(y))
    return [...up, ...column.filter((id) => !chainOf.has(id)), ...down]
  })
}

/**
 * The order with the first loop slot of every back flow right after its source node
 * and the last one right before its target node (a flow with one slot has it after
 * its source), the others at the end of their columns. The slots around one node
 * are nested: the nearest to the node is the one of the shortest flow.
 */
function besideNodes(order: number[][], graph: OrderGraph): number[][] {
  const isLoop = new Set(graph.chains.flat())
  const node = (id: number) => graph.ties[id].map(([other]) => other).find((o) => !isLoop.has(o))
  const before = new Map<number, number[]>()
  const after = new Map<number, number[]>()
  const beside = new Set<number>()
  const put = (list: Map<number, number[]>, id: number, owner?: number) => {
    if (owner === undefined) return
    list.set(owner, [...(list.get(owner) ?? []), id])
    beside.add(id)
  }
  // shortest flows first, so that what is put around a node is in nesting order
  for (const chain of graph.chains) {
    const [first, last] = [chain[0], chain.at(-1) as number]
    put(after, first, node(first))
    if (last !== first) put(before, last, node(last))
  }
  const rest = arrange(order, graph, new Set())
  return rest.map((column) =>
    column
      .filter((id) => !beside.has(id))
      .flatMap((id) => {
        if (isLoop.has(id)) return [id]
        return [...[...(before.get(id) ?? [])].reverse(), id, ...(after.get(id) ?? [])]
      })
  )
}

/**
 * The flows whose two nodes have less in front of them than behind them in their
 * columns, taking only the slots that are not loop slots into account: those are
 * the ones whose turns are shorter on the near side of the columns.
 */
function nearerStart(order: number[][], graph: OrderGraph): Set<number> {
  const isLoop = new Set(graph.chains.flat())
  const room = new Map<number, [before: number, after: number]>()
  for (const column of order) {
    const slots = column.filter((id) => !isLoop.has(id))
    const total = slots.reduce((sum, id) => sum + graph.size[id], 0)
    let before = 0
    for (const id of slots) {
      room.set(id, [before, total - before - graph.size[id]])
      before += graph.size[id]
    }
  }
  const above = new Set<number>()
  graph.chains.forEach((chain, i) => {
    // the two nodes are the slots the first and the last loop slot are tied to across a turn
    const ends = [chain[0], chain.at(-1) as number].flatMap((id) =>
      graph.ties[id].map(([other]) => other).filter((other) => room.has(other))
    )
    const near = ends.reduce((sum, id) => sum + (room.get(id) as [number, number])[0], 0)
    const far = ends.reduce((sum, id) => sum + (room.get(id) as [number, number])[1], 0)
    if (near < far) above.add(i)
  })
  return above
}

const keyOf = (order: readonly (readonly number[])[]) =>
  order.map((column) => column.join(',')).join(';')

/**
 * The order of the slots of each column, by slot id. Every sweep is tried both
 * on from where the previous one ended and on the best order so far: a sweep
 * can walk into an order that is worse than the one before it, from where the
 * next one cannot get back. A sweep cannot move the loops of the back flows to
 * the other side of the nodes, so that is tried on purpose afterwards: with
 * every loop at the start of the columns, at the end of them, and on the side
 * where its nodes are nearer, and each of them set right by swapping. Of all of
 * these the cheapest order wins, the shorter routes among equal crossings.
 */
export function orderSlots(graph: OrderGraph): number[][] {
  let current = graph.columns.map((column) => keepRanks([...column], graph.rank))
  let best = current
  let fewest = crossingCost(current, graph)
  const index = indexHooks(graph)
  // an order that comes up again has been counted already
  const counted = new Set<string>()
  const consider = (candidate: number[][], margin = 0) => {
    const key = keyOf(candidate)
    if (counted.has(key)) return
    counted.add(key)
    const cost = crossingCost(candidate, graph)
    if (cheaper(cost, fewest, margin)) {
      best = candidate
      fewest = cost
    }
  }
  for (let round = 0; round < ROUNDS && fewest[1] > 0; round++) {
    for (const forward of [true, false]) {
      current = transpose(sweep(current, graph, forward), graph, index)
      consider(current)
      if (fewest[1] > 0) consider(transpose(sweep(best, graph, forward), graph, index))
    }
  }
  if (graph.chains.length) {
    const sides = [new Set<number>(), new Set(graph.chains.keys()), nearerStart(best, graph)]
    const tried = new Set([keyOf(best)])
    const attempt = (arranged: number[][]) => {
      // an arrangement that is the order already, or one tried, has nothing new to show
      if (tried.has(keyOf(arranged))) return
      tried.add(keyOf(arranged))
      consider(transpose(arranged, graph, index, 1), SIDE_MARGIN)
    }
    for (const above of sides) attempt(arrange(best, graph, above))
    attempt(besideNodes(best, graph))
  }
  return best
}
