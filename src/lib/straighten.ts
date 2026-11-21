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

/** A flow between two slots that wants `b` to start `shift` after `a`. */
export interface Tie {
  a: Place
  b: Place
  shift: number
  weight: number
}

const EPSILON = 1e-9

/**
 * Numbers the slots through the columns. A unit is a set of slots that share a
 * level, at first every slot on its own; `lo` and `hi` are the earliest and the
 * latest level of a unit that its columns allow.
 */
function number(stacks: Stack[]) {
  const first = stacks.map(() => 0)
  let count = 0
  stacks.forEach((stack, c) => {
    first[c] = count
    count += stack.tops.length
  })
  const bar: number[] = []
  const gap: number[] = []
  const above: number[] = []
  const below: number[] = []
  const lo: number[] = []
  const hi: number[] = []
  stacks.forEach((stack, c) => {
    const size = stack.tops.length
    const last = first[c] + size - 1
    // a column that overflows its room keeps all of what it takes
    const taken = stack.bars.reduce((sum, b, i) => sum + b + (i ? stack.gaps[i - 1] : 0), 0)
    let low = stack.start
    for (let s = first[c]; s <= last; s++) {
      bar[s] = stack.bars[s - first[c]]
      gap[s] = s < last ? stack.gaps[s - first[c]] : 0
      above[s] = s > first[c] ? s - 1 : -1
      below[s] = s < last ? s + 1 : -1
      lo[s] = low
      low += bar[s] + gap[s]
    }
    let high = Math.max(stack.end, stack.start + taken)
    for (let s = last; s >= first[c]; s--) {
      hi[s] = high - bar[s]
      high = hi[s] - (above[s] < 0 ? 0 : gap[above[s]])
    }
  })
  const unit = bar.map((_, s) => s)
  const members = unit.map((s) => [s])
  return { above, bar, below, count, first, gap, hi, lo, members, unit }
}

/**
 * Makes the flows that skip columns run level across them. A flow has a
 * waypoint in every column it skips. Two neighbouring waypoints of a flow are
 * tied to the same level whenever every column still fits with them tied, the
 * thickest flows first, and a flow that cannot run level all the way keeps a
 * bend where a tie did not fit. Then everything is moved towards where its
 * flows meet their ports, tied waypoints as one, keeping the order and the
 * gaps of the columns.
 *
 * Returns false, and changes nothing, when no two waypoints could be tied.
 */
export function straighten(
  stacks: Stack[],
  chains: ReadonlyArray<readonly Place[]>,
  ties: readonly Tie[],
  passes: number
): boolean {
  const { above, bar, below, count, first, gap, hi, lo, members, unit } = number(stacks)
  const id = ([c, i]: Place) => first[c] + i

  /**
   * Raises the earliest level of unit `from` to `level` (or lowers its latest one), and
   * with it those of everything the unit pushes. False when something would have to start
   * later than its latest level; `undo` then holds what was changed.
   */
  const spread = (from: number, level: number, down: boolean, undo: number[]) => {
    const [mine, limit, next] = down ? [lo, hi, below] : [hi, lo, above]
    const sign = down ? 1 : -1
    const set = (u: number, value: number) => {
      undo.push(down ? 0 : 1, u, mine[u])
      mine[u] = value
    }
    if ((level - limit[from]) * sign > EPSILON) return false
    set(from, level)
    const queue = [from]
    /** Makes the slot next to `s` give way to unit `u`; false when it has no room to. */
    const giveWay = (u: number, s: number) => {
      const other = next[s]
      if (other < 0) return true
      const v = unit[other]
      // what the slot and the gap between the two take
      const step = down ? bar[s] + gap[s] : bar[other] + gap[other]
      const need = mine[u] + sign * step
      if ((need - mine[v]) * sign <= EPSILON) return true
      if (v === u || (need - limit[v]) * sign > EPSILON) return false
      set(v, need)
      queue.push(v)
      return true
    }
    while (queue.length) {
      const u = queue.pop() as number
      if (!members[u].every((s) => giveWay(u, s))) return false
    }
    return true
  }

  /**
   * Ties unit `b` to unit `a` when the columns still fit: the earliest level of
   * everything after them and the latest level of everything before them are
   * worked out again, and nothing may end up later than its latest level.
   */
  const tie = (a: number, b: number) => {
    const undo: number[] = []
    const [low, high] = [Math.max(lo[a], lo[b]), Math.min(hi[a], hi[b])]
    const moved = members[b]
    for (const s of moved) unit[s] = a
    members[a].push(...moved)
    members[b] = []
    if (spread(a, low, true, undo) && spread(a, high, false, undo)) return true
    // put everything back
    for (let i = undo.length - 3; i >= 0; i -= 3) (undo[i] ? hi : lo)[undo[i + 1]] = undo[i + 2]
    members[a].length -= moved.length
    members[b] = moved
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

  const units = members.flatMap((list, u) => (list.length ? [u] : []))
  const pos = new Float64Array(count)
  stacks.forEach((stack, c) => {
    stack.tops.forEach((top, i) => {
      const u = unit[first[c] + i]
      pos[u] += top / members[u].length
    })
  })

  // By earliest level every slot comes after the ones that push it, so one round settles
  // the levels and a second one finds nothing to move.
  const sequence = unit.map((_, s) => s).sort((s, r) => lo[unit[s]] - lo[unit[r]] || s - r)
  const reversed = sequence.slice().reverse()

  /**
   * The levels nearest to `wanted` that keep the order and the gaps, found by
   * pushing later slots on (`down`) or earlier ones back. Neither goes past
   * the earliest or the latest level of a unit, so both always fit.
   */
  const push = (wanted: Float64Array, down: boolean) => {
    const level = wanted.slice()
    const sign = down ? 1 : -1
    const [near, bound, order] = down ? [above, hi, sequence] : [below, lo, reversed]
    /** Moves the unit of slot `s` off the slot before it (after it, when pushing back). */
    const settle = (s: number) => {
      const other = near[s]
      if (other < 0) return false
      const size = down ? bar[other] + gap[other] : bar[s] + gap[s]
      const limit = level[unit[other]] + sign * size
      if ((limit - level[unit[s]]) * sign <= EPSILON) return false
      level[unit[s]] = limit
      return true
    }
    for (let round = 0, moved = true; moved && round < count; round++) {
      moved = false
      for (const s of order) moved = settle(s) || moved
    }
    for (const u of units) if ((level[u] - bound[u]) * sign > 0) level[u] = bound[u]
    return level
  }

  const outer = ties
    .map((t) => ({ shift: t.shift, ua: unit[id(t.a)], ub: unit[id(t.b)], weight: t.weight }))
    .filter((t) => t.ua !== t.ub)
  const total = new Float64Array(count)
  const weight = new Float64Array(count)
  /** Where every unit is wanted: half way to where its flows meet, within what its columns allow. */
  const wishes = () => {
    total.fill(0)
    weight.fill(0)
    for (const { shift, ua, ub, weight: w } of outer) {
      total[ua] += (pos[ub] - shift) * w
      weight[ua] += w
      total[ub] += (pos[ua] + shift) * w
      weight[ub] += w
    }
    const wanted = pos.slice()
    for (const u of units) {
      // only half way, so that two units do not swap their wishes for ever
      if (weight[u]) wanted[u] = (pos[u] + total[u] / weight[u]) / 2
      wanted[u] = Math.min(Math.max(wanted[u], lo[u]), hi[u])
    }
    return wanted
  }
  for (let pass = 0; pass < passes; pass++) {
    const wanted = wishes()
    const later = push(wanted, true)
    const earlier = push(wanted, false)
    for (const u of units) pos[u] = (later[u] + earlier[u]) / 2
  }

  stacks.forEach((stack, c) => {
    stack.tops.forEach((_, i) => {
      stack.tops[i] = pos[unit[first[c] + i]]
    })
  })
  return true
}
