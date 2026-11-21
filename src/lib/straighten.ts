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
  // slots are numbered through the columns; a unit is a set of slots that share a level
  const first = stacks.map(() => 0)
  let count = 0
  stacks.forEach((stack, c) => {
    first[c] = count
    count += stack.tops.length
  })
  const id = ([c, i]: Place) => first[c] + i
  const bar: number[] = []
  const gap: number[] = []
  const above: number[] = []
  const below: number[] = []
  const unit: number[] = []
  const members: number[][] = []
  const lo: number[] = []
  const hi: number[] = []
  stacks.forEach((stack, c) => {
    const size = stack.tops.length
    // a column that overflows its room keeps all of what it takes
    const taken = stack.bars.reduce((sum, b, i) => sum + b + (i ? stack.gaps[i - 1] : 0), 0)
    const end = Math.max(stack.end, stack.start + taken)
    let low = stack.start
    for (let i = 0; i < size; i++) {
      const s = first[c] + i
      bar[s] = stack.bars[i]
      gap[s] = i < size - 1 ? stack.gaps[i] : 0
      above[s] = i ? s - 1 : -1
      below[s] = i < size - 1 ? s + 1 : -1
      unit[s] = s
      members[s] = [s]
      lo[s] = low
      low += bar[s] + gap[s]
    }
    let high = end
    for (let i = size - 1; i >= 0; i--) {
      const s = first[c] + i
      hi[s] = high - bar[s]
      high = hi[s] - (i ? stack.gaps[i - 1] : 0)
    }
  })

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
    while (queue.length) {
      const u = queue.pop() as number
      for (const s of members[u]) {
        const other = next[s]
        if (other < 0) continue
        const v = unit[other]
        // what the slot and the gap between the two take
        const step = down ? bar[s] + gap[s] : bar[other] + gap[other]
        const need = mine[u] + sign * step
        if ((need - mine[v]) * sign <= EPSILON) continue
        if (v === u || (need - limit[v]) * sign > EPSILON) return false
        set(v, need)
        queue.push(v)
      }
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

  /**
   * The levels nearest to `wanted` that keep the order and the gaps, found by
   * pushing later slots on (`down`) or earlier ones back. Neither goes past
   * the earliest or the latest level of a unit, so both always fit.
   */
  const push = (wanted: Float64Array, down: boolean) => {
    const level = wanted.slice()
    for (let round = 0, moved = true; moved && round < count; round++) {
      moved = false
      for (let n = 0; n < count; n++) {
        const s = sequence[down ? n : count - 1 - n]
        const other = down ? above[s] : below[s]
        if (other < 0) continue
        const u = unit[s]
        const v = unit[other]
        const limit = down ? level[v] + bar[other] + gap[other] : level[v] - bar[s] - gap[s]
        if (down ? level[u] < limit - EPSILON : level[u] > limit + EPSILON) {
          level[u] = limit
          moved = true
        }
      }
    }
    for (const u of units) level[u] = down ? Math.min(level[u], hi[u]) : Math.max(level[u], lo[u])
    return level
  }

  const outer = ties
    .map((t) => ({ shift: t.shift, ua: unit[id(t.a)], ub: unit[id(t.b)], weight: t.weight }))
    .filter((t) => t.ua !== t.ub)
  const total = new Float64Array(count)
  const weight = new Float64Array(count)
  for (let pass = 0; pass < passes; pass++) {
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
      // half way to where the flows meet, so that two units do not swap their wishes for ever
      if (weight[u]) wanted[u] = (pos[u] + total[u] / weight[u]) / 2
      wanted[u] = Math.min(Math.max(wanted[u], lo[u]), hi[u])
    }
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
