import { ROUNDS, TRANSPOSE_PASSES } from './constants.js'

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
type Cost = readonly [weight: number, count: number]

/** Whether the cost `a` is lower than `b`: by weight, and by count when the weights are equal. */
const cheaper = (a: Cost, b: Cost) =>
  a[0] < b[0] - EPSILON * Math.max(1, b[0]) ||
  (Math.abs(a[0] - b[0]) <= EPSILON * Math.max(1, b[0]) && a[1] < b[1])

/**
 * Weight of the pairs of edges between two columns that cross, each pair
 * weighing the smaller of its two flows. A crossing pair is made of an edge
 * and a heavier one, so the edges are taken from the heaviest down and each
 * adds its flow once for every already taken edge it crosses.
 */
function weightedCrossings(edges: readonly Edge[], sources: number, targets: number): Cost {
  if (edges.length < 2) return [0, 0]
  const taken = new TakenEdges(sources, targets)
  let weight = 0
  let count = 0
  for (const [from, to, flow] of [...edges].sort((a, b) => b[2] - a[2])) {
    const crossing = taken.crossing(from + 1, to + 1)
    weight += flow * crossing
    count += crossing
    taken.add(from + 1, to + 1)
  }
  return [weight, count]
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
  return [weight, count]
}

/** The weight of the crossings of an order. */
export const countCrossings = (order: readonly (readonly number[])[], graph: OrderGraph): number =>
  crossingCost(order, graph)[0]

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
  return [weight, count]
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
  return [weight, count]
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
  if (other === hook.a || other === hook.b) return [0, 0]
  const inside = (at: At) => {
    const [lo, hi] = spanAt(hook, at)
    return Number(at(other) > lo && at(other) < hi)
  }
  const change = inside(after) - inside(before)
  if (!change) return [0, 0]
  const bands = (hook.side === 'right' ? graph.downs : graph.ups)[other]
  return [
    change * bands.reduce((sum, [, flow]) => sum + Math.min(hook.weight, flow), 0),
    change * bands.length,
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
  return [weight, count]
}

/**
 * What swapping two neighbouring slots changes in the weight of the turns of
 * the back flows. Of the turns that end at neither slot nothing changes, since
 * the two stay on the same side of everything else. Of a turn that ends at one
 * of them, the other slot may enter or leave the span it crosses the bands of,
 * and it may interleave with other turns of its edge differently.
 */
function hookDelta(a: number, b: number, graph: OrderGraph, index: HookIndex, pos: number[]): Cost {
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
  return [weight, count]
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
  pos: number[]
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
  return [weight + hw, count + hn]
}

/** One pass over a column: swaps the neighbours that lower the weight; true when it swapped any. */
function transposeColumn(
  column: number[],
  graph: OrderGraph,
  index: HookIndex,
  pos: number[]
): boolean {
  let any = false
  for (let i = 0; i + 1 < column.length; i++) {
    const [a, b] = [column[i], column[i + 1]]
    if (graph.rank[a] !== undefined && graph.rank[b] !== undefined) continue
    if (cheaper(swapDelta(a, b, graph, index, pos), [0, 0])) {
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
function transpose(order: number[][], graph: OrderGraph, index: HookIndex): number[][] {
  const result = order.map((column) => [...column])
  const pos = positions(result, graph.ups.length)
  for (let pass = 0; pass < TRANSPOSE_PASSES; pass++) {
    // every column is passed over, so no short circuit
    const done = result.map((column) => transposeColumn(column, graph, index, pos))
    if (!done.includes(true)) break
  }
  return result
}

/**
 * The order of the slots of each column, by slot id. Every sweep is tried both
 * on from where the previous one ended and on the best order so far: a sweep
 * can walk into an order that is worse than the one before it, from where the
 * next one cannot get back.
 */
export function orderSlots(graph: OrderGraph): number[][] {
  let current = graph.columns.map((column) => keepRanks([...column], graph.rank))
  let best = current
  let fewest = crossingCost(current, graph)
  const index = indexHooks(graph)
  // an order that comes up again has been counted already
  const counted = new Set<string>()
  const consider = (candidate: number[][]) => {
    const key = candidate.map((column) => column.join(',')).join(';')
    if (counted.has(key)) return
    counted.add(key)
    const cost = crossingCost(candidate, graph)
    if (cheaper(cost, fewest)) {
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
  return best
}
