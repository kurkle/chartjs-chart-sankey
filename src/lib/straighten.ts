/** A place in a column: the column and the row. */
export type Place = readonly [column: number, row: number]

/** A column of slots along the cross axis, in pixels. */
export interface Stack {
  /** Where each slot starts; this is what `straighten` decides */
  tops: number[]
  /** Size of each slot */
  bars: readonly number[]
  /** Gap between each slot and the next one */
  gaps: readonly number[]
  /** Where the room of the column starts and ends */
  start: number
  end: number
}

const EPSILON = 1e-9

/**
 * Makes the flows that skip columns run level across them. A flow has a
 * waypoint in every column it skips. Two neighbouring waypoints of a flow are
 * tied to the same level whenever every column still fits with them tied, the
 * thickest flows first, and a flow that cannot run level all the way keeps a
 * bend where a tie did not fit. The slots then move as little as they must
 * to keep the order and the gaps of their columns.
 *
 * Returns false, and changes nothing, when no two waypoints could be tied.
 */
export function straighten(stacks: Stack[], chains: ReadonlyArray<readonly Place[]>): boolean {
  // slots are numbered through the columns; a unit is a set of slots that share a level
  const first: number[] = []
  const bar: number[] = []
  const step: number[] = []
  const above: number[] = []
  const below: number[] = []
  const floor: number[] = []
  const ceiling: number[] = []
  const tops: number[] = []
  for (const stack of stacks) {
    const from = bar.length
    const last = from + stack.bars.length - 1
    first.push(from)
    stack.bars.forEach((size, i) => {
      const s = from + i
      bar.push(size)
      step.push(size + (s < last ? stack.gaps[i] : 0))
      above.push(i ? s - 1 : -1)
      below.push(s < last ? s + 1 : -1)
      floor.push(stack.start)
      tops.push(stack.tops[i])
    })
    // a column that overflows its room keeps all of what it takes
    const taken = step.slice(from).reduce((sum, size) => sum + size, 0)
    for (let s = from; s <= last; s++) ceiling.push(Math.max(stack.end, stack.start + taken))
  }
  const count = bar.length
  const id = ([c, i]: Place) => first[c] + i
  const unit = bar.map((_, s) => s)
  const members = unit.map((s) => [s])

  /** Where the slot may start at the earliest, or at the latest, with its neighbour where it is. */
  const earliest = (s: number, at: number[]) =>
    above[s] < 0 ? floor[s] : at[unit[above[s]]] + step[above[s]]
  const latest = (s: number, at: number[]) =>
    below[s] < 0 ? ceiling[s] - bar[s] : at[unit[below[s]]] - step[s]

  /**
   * The levels nearest to `wanted` at which every slot is after the one before it and
   * the start of its column (`down`), or before the one after it and the end.
   */
  const push = (wanted: number[], down: boolean) => {
    const level = wanted.slice()
    const sign = down ? 1 : -1
    /** Moves the unit of a slot to the limit of the slot when it is past it. */
    const settle = (s: number) => {
      const limit = down ? earliest(s, level) : latest(s, level)
      if ((limit - level[unit[s]]) * sign <= EPSILON) return false
      level[unit[s]] = limit
      return true
    }
    for (let round = 0, moved = true; moved && round < count; round++) {
      moved = false
      for (let n = 0; n < count; n++) moved = settle(down ? n : count - 1 - n) || moved
    }
    return level
  }

  // the earliest level of every unit: the columns fit as long as none of them ends after its column
  const lo = push(floor, true)

  // the latest level of every slot while nothing is tied
  const hi = push(ceiling, false)

  /** Ties unit `b` to unit `a` when the columns still fit with the two on one level. */
  const tie = (a: number, b: number) => {
    const undo = [a, lo[a]]
    const moved = members[b]
    lo[a] = Math.max(lo[a], lo[b])
    for (const s of moved) unit[s] = a
    members[a].push(...moved)
    const queue = [a]
    /** Makes the slot after `s` start after it; false when a column overflows or the flows cross. */
    const giveWay = (s: number) => {
      const u = unit[s]
      // a slot that starts after its latest level pushes the end of its column out
      if (lo[u] > hi[s] + EPSILON) return false
      if (below[s] < 0) return true
      const v = unit[below[s]]
      if (lo[u] + step[s] <= lo[v] + EPSILON) return true
      if (v === a) return false
      undo.push(v, lo[v])
      lo[v] = lo[u] + step[s]
      queue.push(v)
      return true
    }
    let fits = true
    while (fits && queue.length) fits = members[queue.pop() as number].every(giveWay)
    if (fits) {
      members[b] = []
      return true
    }
    for (let i = undo.length - 2; i >= 0; i -= 2) lo[undo[i]] = undo[i + 1]
    members[a].length -= moved.length
    for (const s of moved) unit[s] = b
    return false
  }

  let tied = false
  for (const chain of chains) {
    for (let i = 1; i < chain.length; i++) {
      if (tie(unit[id(chain[i - 1])], unit[id(chain[i])])) tied = true
    }
  }
  if (!tied) return false

  // a unit starts from the mean of its slots, and is pushed both ways alike
  const mean = tops.map(() => 0)
  tops.forEach((top, s) => {
    mean[unit[s]] += top / members[unit[s]].length
  })
  const later = push(push(mean, true), false)
  const earlier = push(push(mean, false), true)
  stacks.forEach((stack, c) => {
    stack.tops.forEach((_, i) => {
      const u = unit[first[c] + i]
      stack.tops[i] = (later[u] + earlier[u]) / 2
    })
  })
  return true
}
