/**
 * Back flows leave their source, run along a lane after the content and enter
 * their target from behind. Which lane a flow takes depends on the columns of
 * its two ends only, so it is decided with the rest of the topology.
 */

export interface LoopInput {
  /** index of the flow in the dataset */
  index: number
  /** source column */
  from: number
  /** target column */
  to: number
}

/**
 * Two loops can share a lane when there is a whole column between them, so
 * that their turns (which live in the gaps next to the columns) cannot meet.
 */
const overlap = (a: LoopInput, b: LoopInput) => a.from + 1 >= b.to && b.from + 1 >= a.to

/**
 * Assign every loop a lane, 0 being the one closest to the content. The
 * shortest loop (fewest columns spanned) goes innermost so that nested loops
 * do not cross; equal spans keep the data order. A loop takes the innermost
 * lane that has no overlapping loop in it yet.
 * @returns lane by flow index
 */
export function assignLanes(loops: LoopInput[]): Map<number, number> {
  const sorted = [...loops].sort((a, b) => a.from - a.to - (b.from - b.to) || a.index - b.index)
  const lanes: LoopInput[][] = []
  const rankOf = new Map<number, number>()
  for (const loop of sorted) {
    let rank = lanes.findIndex((members) => !members.some((m) => overlap(m, loop)))
    if (rank < 0) rank = lanes.push([]) - 1
    lanes[rank].push(loop)
    rankOf.set(loop.index, rank)
  }
  return rankOf
}
