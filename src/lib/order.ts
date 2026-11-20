/**
 * Order of the slots (the nodes and the waypoints of the flows that skip
 * columns) within each column. The graph is layered, so the order is chosen
 * to keep the flows between neighbouring columns from crossing: start from a
 * given order, then sweep forward and backward moving every slot towards the
 * flow-weighted mean position of its neighbours, and keep the order with the
 * fewest crossings. Ties keep the earlier order, so the result is stable.
 */

/** Rounds of one forward and one backward sweep. */
export const ROUNDS = 4

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

/** Pairs (a, b) of edges between two columns where a starts above b and ends below it. */
function inversions(values: readonly number[], range: number): number {
  const tree = new Array<number>(range + 1).fill(0)
  let count = 0
  let seen = 0
  for (const value of values) {
    let below = 0
    for (let i = value + 1; i > 0; i -= i & -i) below += tree[i]
    count += seen - below
    for (let i = value + 1; i <= range; i += i & -i) tree[i]++
    seen++
  }
  return count
}

/** Number of crossings between the flows of neighbouring columns, and between them and the back flows' ends. */
export function countCrossings(
  order: readonly (readonly number[])[],
  downs: OrderGraph['downs'],
  stubs: OrderGraph['stubs'] = []
): number {
  const pos = positions(order, downs.length)
  let total = 0
  for (let c = 0; c < order.length - 1; c++) {
    const edges: Array<[number, number]> = []
    for (const id of order[c]) {
      for (const [other] of downs[id]) edges.push([pos[id], pos[other]])
    }
    edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    total += inversions(
      edges.map((edge) => edge[1]),
      order[c + 1].length
    )
    for (const stub of stubs) {
      // the gap this stub crosses holds the bands between its column and the next (or the previous)
      if (stub.column + (stub.end === 'out' ? 0 : -1) !== c) continue
      total += edges.filter(([a, b]) => (stub.end === 'out' ? a : b) > pos[stub.id]).length
    }
  }
  return total
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

function sweep(order: number[][], graph: OrderGraph, forward: boolean): number[][] {
  const result = order.map((column) => [...column])
  const pulls: Stub[][] = []
  for (const stub of graph.stubs) {
    pulls[stub.id] = [...(pulls[stub.id] ?? []), stub]
  }
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
      // a back flow pulls its ends towards the end of the cross axis, where its lane is
      for (const stub of pulls[id] ?? []) {
        sum += neighbourLength(forward, c, result) * stub.weight
        weight += stub.weight
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
 * The order of the slots of each column, by slot id. Every sweep is tried both
 * on from where the previous one ended and on the best order so far: a sweep
 * can walk into an order that is worse than the one before it, from where the
 * next one cannot get back.
 */
export function orderSlots(graph: OrderGraph): number[][] {
  let current = graph.columns.map((column) => keepRanks([...column], graph.rank))
  let best = current
  let fewest = countCrossings(current, graph.downs, graph.stubs)
  const consider = (candidate: number[][]) => {
    const crossings = countCrossings(candidate, graph.downs, graph.stubs)
    if (crossings < fewest) {
      best = candidate
      fewest = crossings
    }
  }
  for (let round = 0; round < ROUNDS && fewest > 0; round++) {
    for (const forward of [true, false]) {
      current = sweep(current, graph, forward)
      consider(current)
      if (fewest > 0) consider(sweep(best, graph, forward))
    }
  }
  return best
}
