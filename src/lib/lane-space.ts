import type { Plan, PlanLink } from './topology.js'

import {
  CORNER,
  EDGE_GAP,
  END_GAP,
  FIRST_GAP,
  LANE_GAP,
  MIN_RUN,
  MIN_THICKNESS,
  SELF_CORNER,
} from './constants.js'

/**
 * The lanes of the back flows. A loop runs after the content of the columns
 * it passes, and beyond the loops it overlaps that come before it in the
 * nesting order; loops that do not overlap share a level. So the room the
 * loops take is a skyline over the columns, not one stack for the whole chart.
 */
export interface Loop {
  link: PlanLink
  /** Target column and source column */
  first: number
  last: number
  /** Inner radius of the turns, before shrinking */
  clear: number
  /** The loops this one stacks on: those before it that overlap it, in the nesting order */
  below: Loop[]
  /** Columns whose content this loop's place depends on: its own and those of the loops below */
  reach: number[]

  // In pixels, for a scale and a shrink factor (`measureLoops`):
  /** Thickness of the band */
  t: number
  /** Least distance from the content to the band */
  level: number
  /** How far the loops below that share the source push the turn at that end out; `into` the same at the target */
  out: number
  into: number
  /** Where the band starts on the cross axis, once the content has its place (`placeLoops`) */
  start: number
}

/** What the loops take, by column, in pixels. */
export interface LaneSpace {
  /** of the cross axis, beyond the content */
  depth: number[]
  /** along the columns, after the column: the turns of the loops that leave it */
  out: number[]
  /** along the columns, before the column: the turns of the loops that enter it */
  into: number[]
  /** between two neighbouring columns: a run kept for the flows between them, when there are loops */
  run: number
}

/** The loops in nesting order, with what they stack on. */
export function buildLoops(plan: Plan): Loop[] {
  const loops: Loop[] = []
  for (const link of plan.loops) {
    const first = link.to.x as number
    const last = link.from.x as number
    // Two loops cannot share a level when there is no whole column between
    // them: their turns live in the gaps next to the columns, and would meet.
    const below = loops.filter((other) => other.last + 1 >= first && last + 1 >= other.first)
    const own = Array.from({ length: last - first + 1 }, (_, i) => first + i)
    loops.push({
      below,
      // a flow from a node to itself wraps around a single node and needs a wider turn to read as a loop
      clear: link.from === link.to ? SELF_CORNER : CORNER,
      first,
      into: 0,
      last,
      level: 0,
      link,
      out: 0,
      reach: [...new Set([...own, ...below.flatMap((other) => other.reach)])],
      start: 0,
      t: 0,
    })
  }
  return loops
}

/** Shortest distance from the content to a lane, before shrinking: a turn needs twice its radius across. */
const firstGap = (loop: Loop) => Math.max(FIRST_GAP, 2 * loop.clear)

/**
 * How far the loops below push a loop out, and never less than `base`: each
 * by where it is itself, its thickness and the gap between the two.
 */
const stack = (
  loop: Loop,
  measure: 'into' | 'level' | 'out' | 'start',
  base: number,
  factor: number,
  sharing: (other: Loop) => boolean = () => true
) =>
  loop.below.filter(sharing).reduce((most, other) => {
    const gap = LANE_GAP + Math.max(0, other.clear - loop.clear)
    return Math.max(most, other[measure] + other.t + gap * factor)
  }, base)

/**
 * Measures the loops for scale `k` (pixels per flow unit). The fixed pixels
 * (gaps, radii, the least thickness) shrink by `factor` when they do not fit.
 */
export function measureLoops(loops: Loop[], columns: number, k: number, factor: number): LaneSpace {
  const zeros = () => new Array<number>(columns).fill(0)
  const run = loops.length ? MIN_RUN * factor : 0
  const space = { depth: zeros(), into: zeros(), out: zeros(), run }
  for (const loop of loops) {
    loop.t = Math.max(k * loop.link.flow, MIN_THICKNESS * factor)
    loop.level = stack(loop, 'level', firstGap(loop) * factor, factor)
    loop.out = stack(loop, 'out', 0, factor, (other) => other.link.from === loop.link.from)
    loop.into = stack(loop, 'into', 0, factor, (other) => other.link.to === loop.link.to)
    // a turn sticks out of its node edge by its radius, the band and what it goes around
    const turn = (loop.clear + EDGE_GAP) * factor + loop.t
    space.out[loop.last] = Math.max(space.out[loop.last], turn + loop.out)
    space.into[loop.first] = Math.max(space.into[loop.first], turn + loop.into)
    for (const column of loop.reach) {
      space.depth[column] = Math.max(space.depth[column], loop.level + loop.t + END_GAP * factor)
    }
  }
  return space
}

/**
 * Lanes start from the content, not from the edge of the chart: a loop runs
 * right after the content of its own columns, unless a loop below it is in
 * the way. `contentEnd` is where the content of each column ends.
 */
export function placeLoops(loops: Loop[], contentEnd: number[], factor: number) {
  for (const loop of loops) {
    const content = Math.max(0, ...contentEnd.slice(loop.first, loop.last + 1))
    loop.start = stack(loop, 'start', content + firstGap(loop) * factor, factor)
  }
}
