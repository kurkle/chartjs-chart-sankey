import type { PlanLink, PlanSlot } from './topology.js'

import { ROUNDS } from './constants.js'

/**
 * Order of the slots (the nodes and the waypoints of the flows that skip
 * columns) within each column. The graph is layered, so the order is chosen
 * to keep the flows between neighbouring columns from crossing: start from a
 * given order, then sweep forward and backward moving every slot towards the
 * flow-weighted mean position of its neighbours, and keep the order with the
 * fewest crossings. Ties keep the earlier order, so the result is stable.
 */
type Order = PlanSlot[][]

/** Writes the place of every slot in its column to its `row`. */
function place(order: Order) {
  for (const column of order) {
    column.forEach((slot, i) => {
      slot.row = i
    })
  }
}

/** The slot a forward flow comes from (`step` -1) or goes to (1), next to `slot`. */
const beside = (link: PlanLink, slot: PlanSlot, step: number) =>
  link.path[slot.column - link.path[0].column + step]

/**
 * A back flow that is drawn. It leaves its source (or enters its target)
 * across the gap beside the slot and runs to the end of the cross axis, so
 * every band in that gap that lies beyond the slot crosses it.
 */
const isLoop = (link: PlanLink) => link.rank !== undefined

/** Pairs (a, b) of bands between two columns where a starts above b and ends below it. */
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

/** Number of crossings between the flows of neighbouring columns, and between them and the ends of the loops. */
export function countCrossings(order: Order): number {
  place(order)
  let total = 0
  for (let c = 0; c < order.length - 1; c++) {
    // the bands between the column and the next, as pairs of rows
    const bands: Array<[number, number]> = []
    for (const slot of order[c]) {
      for (const link of slot.out) {
        if (!link.back) bands.push([slot.row, beside(link, slot, 1).row])
      }
    }
    bands.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    total += inversions(
      bands.map((band) => band[1]),
      order[c + 1].length
    )
    // the end of a loop crosses the bands that start (or end) beyond its slot
    const beyond = (slots: PlanSlot[], links: 'in' | 'out', end: 0 | 1) => {
      const after = new Array<number>(slots.length + 1).fill(0)
      for (const band of bands) after[band[end]]++
      for (let i = slots.length - 1; i >= 0; i--) after[i] += after[i + 1]
      slots.forEach((slot, i) => {
        for (const link of slot[links]) {
          if (isLoop(link)) total += link.top ? bands.length - after[i] : after[i + 1]
        }
      })
    }
    beyond(order[c], 'out', 0)
    beyond(order[c + 1], 'in', 1)
  }
  return total
}

/** Puts the nodes back in the order of their priority, keeping the places they occupy. */
function keepRanks(slots: PlanSlot[], ranked: boolean): PlanSlot[] {
  if (!ranked) return slots
  const nodes = slots
    .filter((slot) => slot.node)
    .sort((a, b) => (a.node?.priority ?? 0) - (b.node?.priority ?? 0))
  return slots.map((slot) => (slot.node ? (nodes.shift() as PlanSlot) : slot))
}

function sweep(
  order: Order,
  ranked: boolean,
  forward: boolean,
  pulls: Map<PlanSlot, [number, number]>
): Order {
  const result = order.map((column) => [...column])
  place(result)
  const step = forward ? 1 : -1
  for (let c = forward ? 1 : result.length - 2; c >= 0 && c < result.length; c += step) {
    // a loop pulls its ends towards the side of the cross axis its lane runs along
    const end = (result[c - step] ?? []).length
    const keyed = result[c].map((slot, index) => {
      let sum = 0
      let weight = 0
      for (const link of forward ? slot.in : slot.out) {
        if (link.back) continue
        sum += beside(link, slot, -step).row * link.flow
        weight += link.flow
      }
      const [after, before] = pulls.get(slot) ?? [0, 0]
      sum += end * after
      weight += after + before
      return { index, mean: weight ? sum / weight : index, slot }
    })
    keyed.sort((a, b) => a.mean - b.mean || a.index - b.index)
    result[c] = keepRanks(
      keyed.map((entry) => entry.slot),
      ranked
    )
    place([result[c]])
  }
  return result
}

/**
 * The order of the slots of each column, starting from the given one. With
 * `ranked` the nodes keep the order of their priority and the waypoints are
 * moved around them. Every sweep is tried both on from where the previous one
 * ended and on the best order so far: a sweep can walk into an order that is
 * worse than the one before it, from where the next one cannot get back.
 */
export function orderSlots(columns: Order, ranked: boolean, pulling = true): Order {
  let current = columns.map((column) => keepRanks(column, ranked))
  let best = current
  let fewest = countCrossings(current)
  // the flow of the loops that end at each slot
  // (towards the end of the cross axis, towards its start)
  const pulls = new Map<PlanSlot, [number, number]>()
  for (const slot of pulling ? columns.flat() : []) {
    for (const link of [...slot.out, ...slot.in].filter(isLoop)) {
      const pull = pulls.get(slot) ?? [0, 0]
      // a loop within one column goes round its target: the source is pulled the other way
      const away = link.from === slot.node && link.from !== link.to && link.from.x === link.to.x
      pull[Boolean(link.top) === away ? 0 : 1] += link.flow
      pulls.set(slot, pull)
    }
  }
  const consider = (candidate: Order) => {
    const crossings = countCrossings(candidate)
    if (crossings < fewest) {
      best = candidate
      fewest = crossings
    }
  }
  for (let round = 0; round < ROUNDS && fewest > 0; round++) {
    for (const forward of [true, false]) {
      current = sweep(current, ranked, forward, pulls)
      consider(current)
      if (fewest > 0) consider(sweep(best, ranked, forward, pulls))
    }
  }
  place(best)
  return best
}
