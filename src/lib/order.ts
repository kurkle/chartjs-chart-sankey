import { ROUNDS, STUB_WEIGHT, TRANSPOSE_PASSES } from './constants.js'

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
 * The end of a back flow at a slot. The flow leaves its source (or enters its
 * target) across the gap beside the slot and runs to the end of the cross axis,
 * so every band in that gap that lies beyond the slot crosses it.
 */
export interface Stub {
  /** Slot id */
  id: number
  column: number
  /** Leaves to the right of the column (`out`) or arrives from the left (`in`) */
  end: 'in' | 'out'
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
  /** Ends of back flows; they count as crossings with the bands beyond their slot */
  stubs: readonly Stub[]
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

/**
 * The cost of the crossings between the flows of neighbouring columns, and
 * between them and the ends of the back flows (a stub weighs its flow times the
 * flow of every band it crosses).
 */
function crossingCost(
  order: readonly (readonly number[])[],
  downs: OrderGraph['downs'],
  stubs: OrderGraph['stubs'] = []
): Cost {
  const pos = positions(order, downs.length)
  // the gap a stub crosses holds the bands between its column and the next (or the previous)
  const byGap: Stub[][] = Array.from({ length: Math.max(0, order.length - 1) }, () => [])
  for (const stub of stubs) byGap[stub.column + (stub.end === 'out' ? 0 : -1)]?.push(stub)

  let weight = 0
  let count = 0
  for (let c = 0; c < order.length - 1; c++) {
    const edges = bandsOfGap(order, downs, c, pos)
    const [w, n] = weightedCrossings(edges, order[c].length, order[c + 1].length)
    weight += w
    count += n
    for (const stub of byGap[c]) {
      const [sw, sn] = stubCrossings(stub, edges, pos[stub.id])
      weight += sw
      count += sn
    }
  }
  return [weight, count]
}

/** The weight of the crossings of an order. */
export const countCrossings = (
  order: readonly (readonly number[])[],
  downs: OrderGraph['downs'],
  stubs: OrderGraph['stubs'] = []
): number => crossingCost(order, downs, stubs)[0]

/** The bands of a gap that start (or end) beyond the slot of a stub, as weight and count. */
function stubCrossings(stub: Stub, edges: readonly Edge[], at: number): Cost {
  let weight = 0
  let count = 0
  for (const [from, to, flow] of edges) {
    if ((stub.end === 'out' ? from : to) > at) {
      weight += STUB_WEIGHT * Math.min(stub.weight, flow)
      count++
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

/** Number of slots in the column the neighbours of column `c` are in. */
function neighbourLength(forward: boolean, c: number, order: number[][]) {
  return (order[forward ? c - 1 : c + 1] ?? []).length
}

/** The ends of the back flows by slot id. */
function pullsOf(graph: OrderGraph): Stub[][] {
  const pulls: Stub[][] = graph.ups.map(() => [])
  for (const stub of graph.stubs) pulls[stub.id].push(stub)
  return pulls
}

function sweep(
  order: number[][],
  graph: OrderGraph,
  pulls: Stub[][],
  forward: boolean
): number[][] {
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
      if (!weight && neighbours[id].length && !pulls[id].length) {
        const plain = neighbours[id].reduce((total, [other]) => total + pos[other], 0)
        return { id, index, mean: plain / neighbours[id].length }
      }
      // a back flow pulls its ends towards the end of the cross axis, where its lane is
      for (const stub of pulls[id]) {
        sum += neighbourLength(forward, c, result) * stub.weight * STUB_WEIGHT
        weight += stub.weight * STUB_WEIGHT
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

/**
 * What swapping two neighbouring slots changes in the weight of the crossings:
 * only the pairs made of a band of the one and a band of the other change, in
 * the gap before the column and in the gap after it, and so do the back flow
 * ends beside the two (which count the bands beyond their own slot).
 */
function swapDelta(a: number, b: number, graph: OrderGraph, pulls: Stub[][], pos: number[]): Cost {
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
  // the ends of the back flows beside the two count the bands beyond their own slot
  const beyond = (stub: Stub, slot: number): Cost => {
    const list = (stub.end === 'out' ? graph.downs : graph.ups)[slot]
    return [
      STUB_WEIGHT * list.reduce((sum, [, flow]) => sum + Math.min(stub.weight, flow), 0),
      list.length,
    ]
  }
  for (const stub of pulls[a]) {
    const [w, n] = beyond(stub, b)
    weight -= w
    count -= n
  }
  for (const stub of pulls[b]) {
    const [w, n] = beyond(stub, a)
    weight += w
    count += n
  }
  return [weight, count]
}

/** One pass over a column: swaps the neighbours that lower the weight; true when it swapped any. */
function transposeColumn(
  column: number[],
  graph: OrderGraph,
  pulls: Stub[][],
  pos: number[]
): boolean {
  let swapped = false
  for (let i = 0; i + 1 < column.length; i++) {
    const [a, b] = [column[i], column[i + 1]]
    if (graph.rank[a] !== undefined && graph.rank[b] !== undefined) continue
    if (cheaper(swapDelta(a, b, graph, pulls, pos), [0, 0])) {
      column[i] = b
      column[i + 1] = a
      pos[a] = i + 1
      pos[b] = i
      swapped = true
    }
  }
  return swapped
}

/**
 * Swaps neighbouring slots of a column when that lowers the weight of the
 * crossings, a bounded number of passes over the columns. Slots with a rank
 * keep their order among themselves.
 */
function transpose(order: number[][], graph: OrderGraph, pulls: Stub[][]): number[][] {
  const result = order.map((column) => [...column])
  const pos = positions(result, graph.ups.length)
  for (let pass = 0; pass < TRANSPOSE_PASSES; pass++) {
    // every column is passed over, so no short circuit
    const swapped = result.map((column) => transposeColumn(column, graph, pulls, pos))
    if (!swapped.includes(true)) break
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
  let fewest = crossingCost(current, graph.downs, graph.stubs)
  const pulls = pullsOf(graph)
  // an order that comes up again has been counted already
  const counted = new Set<string>()
  const consider = (candidate: number[][]) => {
    const key = candidate.map((column) => column.join(',')).join(';')
    if (counted.has(key)) return
    counted.add(key)
    const cost = crossingCost(candidate, graph.downs, graph.stubs)
    if (cheaper(cost, fewest)) {
      best = candidate
      fewest = cost
    }
  }
  for (let round = 0; round < ROUNDS && fewest[1] > 0; round++) {
    for (const forward of [true, false]) {
      current = transpose(sweep(current, graph, pulls, forward), graph, pulls)
      consider(current)
      if (fewest[1] > 0) consider(transpose(sweep(best, graph, pulls, forward), graph, pulls))
    }
  }
  return best
}
