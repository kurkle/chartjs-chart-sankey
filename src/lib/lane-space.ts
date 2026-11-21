import type { SankeyNode } from '../types.js'
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
  /** The back flows that share the lane, the one nearest to the content (the shortest) first */
  members: PlanLink[]
  /** The lane runs before the content on the cross axis */
  top: boolean
  /** The nearest target column and the farthest source column */
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
  /** Thickness of the members nearer to the content than each member: all of them, those from its source, those to its target */
  inner: Map<PlanLink, number>
  innerOut: Map<PlanLink, number>
  innerIn: Map<PlanLink, number>
  /** Thickness of the members that leave each source node, and how far the loops below that leave it too push their turns out */
  tAt: Map<SankeyNode, number>
  outAt: Map<SankeyNode, number>
  /** The same at each target node */
  tIn: Map<SankeyNode, number>
  intoAt: Map<SankeyNode, number>
  /** Where the band starts on the cross axis, once the content has its place (`placeLoops`) */
  start: number
}

/** What the loops take, by column, in pixels. */
export interface LaneSpace {
  /** of the cross axis, beyond the content */
  depth: number[]
  /** of the cross axis, before the content */
  depthTop: number[]
  /** along the columns, after the column: the turns of the loops that leave it */
  out: number[]
  /** along the columns, before the column: the turns of the loops that enter it */
  into: number[]
  /** between two neighbouring columns: a run kept for the flows between them, when there are loops */
  run: number
}

/** The loops in nesting order, with what they stack on. */
export function buildLoops(plan: Plan): Loop[] {
  const lanes = new Map<object, PlanLink[]>()
  for (const link of plan.loops) {
    const lane = link.lane ?? link
    lanes.set(lane, [...(lanes.get(lane) ?? []), link])
  }
  const column = (link: PlanLink) => link.from.x as number
  const target = (link: PlanLink) => link.to.x as number
  const span = (members: PlanLink[]) =>
    Math.max(...members.map(column)) - Math.min(...members.map(target))
  const loops: Loop[] = []
  for (const members of [...lanes.values()].sort((a, b) => span(a) - span(b))) {
    // the shortest member runs nearest to the content, so the others go round it
    members.sort((a, b) => span([a]) - span([b]) || a.index - b.index)
    const link = members[0]
    const top = !!link.top
    const first = Math.min(...members.map(target))
    const last = Math.max(...members.map(column))
    // Two loops cannot share a level when there is no whole column between
    // them: their turns live in the gaps next to the columns, and would meet.
    const below = loops.filter(
      (other) => other.top === top && other.last + 1 >= first && last + 1 >= other.first
    )
    const own = Array.from({ length: last - first + 1 }, (_, i) => first + i)
    loops.push({
      below,
      // a flow from a node to itself wraps around a single node and needs a wider turn to read as a loop
      clear: link.from === link.to ? SELF_CORNER : CORNER,
      first,
      inner: new Map(),
      innerIn: new Map(),
      innerOut: new Map(),
      intoAt: new Map(),
      last,
      level: 0,
      link,
      members,
      outAt: new Map(),
      reach: [...new Set([...own, ...below.flatMap((other) => other.reach)])],
      start: 0,
      t: 0,
      tAt: new Map(),
      tIn: new Map(),
      top,
    })
  }
  // ports: the outer lanes first, and in a lane the outer members first
  loops.forEach((loop, rank) => {
    loop.members.forEach((member, i) => {
      member.rank = rank + i / loop.members.length
    })
  })
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
  measure: 'level' | 'start',
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
  const space = { depth: zeros(), depthTop: zeros(), into: zeros(), out: zeros(), run }
  for (const loop of loops) {
    loop.tAt.clear()
    loop.tIn.clear()
    loop.t = 0
    for (const member of loop.members) {
      const t = Math.max(k * member.flow, MIN_THICKNESS * factor)
      loop.inner.set(member, loop.t)
      loop.innerOut.set(member, loop.tAt.get(member.from) ?? 0)
      loop.innerIn.set(member, loop.tIn.get(member.to) ?? 0)
      loop.t += t
      loop.tAt.set(member.from, (loop.tAt.get(member.from) ?? 0) + t)
      loop.tIn.set(member.to, (loop.tIn.get(member.to) ?? 0) + t)
    }
    loop.level = stack(loop, 'level', firstGap(loop) * factor, factor)
    // a turn sticks out of its node edge by its radius, the bands and what it goes around
    const edge = (loop.clear + EDGE_GAP) * factor
    const ends = (mine: 'tAt' | 'tIn', pushed: 'outAt' | 'intoAt', room: number[]) => {
      for (const [node, t] of loop[mine]) {
        const push = loop.below.reduce((most, other) => {
          const theirs = other[mine].get(node)
          if (theirs === undefined) return most
          const gap = LANE_GAP + Math.max(0, other.clear - loop.clear)
          return Math.max(most, (other[pushed].get(node) as number) + theirs + gap * factor)
        }, 0)
        loop[pushed].set(node, push)
        const c = node.x as number
        room[c] = Math.max(room[c], edge + t + push)
      }
    }
    ends('tAt', 'outAt', space.out)
    ends('tIn', 'intoAt', space.into)
    const depth = loop.top ? space.depthTop : space.depth
    for (const column of loop.reach) {
      depth[column] = Math.max(depth[column], loop.level + loop.t + END_GAP * factor)
    }
  }
  return space
}

/**
 * Lanes start from the content, not from the edge of the chart: a loop runs
 * right after the content of its own columns, unless a loop below it is in
 * the way. `contentEnd` is where the content of each column ends.
 */
export function placeLoops(
  loops: Loop[],
  contentStart: number[],
  contentEnd: number[],
  factor: number
) {
  for (const loop of loops) {
    const columns = [loop.first, loop.last + 1] as const
    if (loop.top) {
      // the edge of the lane next to the content: the lane grows away from it
      const content = Math.min(...contentStart.slice(...columns))
      loop.start = loop.below.reduce(
        (least, other) => {
          const gap = LANE_GAP + Math.max(0, other.clear - loop.clear)
          return Math.min(least, other.start - other.t - gap * factor)
        },
        content - firstGap(loop) * factor
      )
    } else {
      const content = Math.max(0, ...contentEnd.slice(...columns))
      loop.start = stack(loop, 'start', content + firstGap(loop) * factor, factor)
    }
  }
}
