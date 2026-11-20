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
 * The room the lanes of the back flows take, written as budgets for the one
 * scale solve (see geometry.ts). Every loop takes room only in the columns it
 * runs under (and those of the loops it stacks on), and loops that do not
 * overlap share a level, so the room is a skyline over the columns, not one
 * stack for the whole chart.
 */

/**
 * A length that grows with the scale, never below `min` pixels. When the fixed
 * pixels have to shrink, the minimum shrinks by the same factor, so that
 * nothing is left over that cannot fit.
 */
export interface Term {
  /** in flow units */
  size: number
  /** in pixels, before shrinking */
  min: number
}

/**
 * A length that stays linear in the scale `k` (pixels per flow unit): `rigid`
 * pixels, `shrinkable` pixels (scaled by the common factor) and terms that
 * grow with the scale.
 */
export interface Extent {
  rigid: number
  shrinkable: number
  terms: Term[]
}

const extent = (shrinkable = 0, terms: Term[] = [], rigid = 0): Extent => ({
  rigid,
  shrinkable,
  terms,
})

export const add = (...parts: Extent[]): Extent =>
  extent(
    parts.reduce((sum, part) => sum + part.shrinkable, 0),
    parts.flatMap((part) => part.terms),
    parts.reduce((sum, part) => sum + part.rigid, 0)
  )

export const termPixels = (term: Term, k: number, factor: number) =>
  Math.max(k * term.size, term.min * factor)

/** Pixels an extent takes at the least, before shrinking: its fixed ones and the minimums of its terms. */
export const floor = (extent: Extent): number =>
  extent.shrinkable + extent.terms.reduce((sum, term) => sum + term.min, 0)

/** The length of the extent for scale `k` and shrink factor `factor`. */
export const measure = (extent: Extent, k: number, factor: number): number =>
  extent.rigid +
  factor * extent.shrinkable +
  extent.terms.reduce((sum, term) => sum + termPixels(term, k, factor), 0)

type StackName = 'cross' | 'into' | 'out'

export interface Loop {
  link: PlanLink
  /** Target column and source column */
  first: number
  last: number
  /** inner radius of the turns, before shrinking */
  clear: number
  /** Thickness of the lane band */
  thickness: Term
  /** The loops this one stacks on: those before it that overlap it, in the nesting order */
  below: Loop[]
  /**
   * What the loop stacks on, by place: the fixed gaps and the thicknesses of
   * the loops under it (the chain that is the highest, so every sum stays
   * linear in the scale). Across, from the content to the lane, every loop it
   * overlaps counts; at the source end (`out`) and at the target end (`into`)
   * only the loops that turn in the same gap.
   */
  cross: Extent
  out: Extent
  into: Extent
  /** Columns whose content this loop's position depends on: its own and those of the loops below */
  reach: number[]
  /** What the loop takes of the cross axis in each column it reaches */
  budget: Extent
}

export interface LaneSpace {
  loops: Loop[]
  /** by column, the budgets of the loops that reach it */
  columns: Extent[][]
  /** on the column axis: before the first column, after the last, and between neighbours */
  lead: Extent
  trail: Extent
  gaps: Extent[]
}

/**
 * Two loops cannot share a level when there is no whole column between them:
 * their turns live in the gaps next to the columns, and would meet.
 */
const overlaps = (a: Loop, b: Loop) => a.last + 1 >= b.first && b.last + 1 >= a.first

/** Which of the loops under `loop` count for a stack. */
const shares: Record<StackName, (other: Loop, loop: Loop) => boolean> = {
  cross: () => true,
  into: (other, loop) => other.link.to === loop.link.to,
  out: (other, loop) => other.link.from === loop.link.from,
}

/** Of the loops, the one that reaches furthest in a stack: the longest chain with its own thickness. */
function highest(loops: Loop[], name: StackName): Loop | undefined {
  const units = (loop: Loop) =>
    loop[name].terms.reduce((sum, term) => sum + term.size, 0) + loop.link.flow
  return loops.reduce<Loop | undefined>(
    (best, loop) => (!best || units(loop) >= units(best) ? loop : best),
    undefined
  )
}

/** Inner radius of the turns of a back flow, before shrinking. */
export const clearanceOf = (link: Pick<PlanLink, 'from' | 'to'>) =>
  link.from === link.to ? SELF_CORNER : CORNER

function stackOn(loop: Loop, name: StackName): Extent {
  const sharing = loop.below.filter((other) => shares[name](other, loop))
  const top = highest(sharing, name)
  // Across, the shortest distance from the content to a lane: a turn needs twice its radius.
  let lift = name === 'cross' ? Math.max(FIRST_GAP, 2 * loop.clear) : 0
  for (const other of sharing) {
    lift = Math.max(lift, other[name].shrinkable + LANE_GAP + Math.max(0, other.clear - loop.clear))
  }
  return extent(lift, top ? [...top[name].terms, top.thickness] : [])
}

/** The loops in nesting order, each with the room it needs. */
function buildLoops(plan: Plan): Loop[] {
  const loops: Loop[] = []
  for (const link of plan.loops) {
    const first = link.to.x as number
    const last = link.from.x as number
    const thickness = { min: MIN_THICKNESS, size: link.flow }
    const loop = { clear: clearanceOf(link), first, last, link, thickness } as Loop
    loop.below = loops.filter((other) => overlaps(other, loop))
    loop.cross = stackOn(loop, 'cross')
    loop.out = stackOn(loop, 'out')
    loop.into = stackOn(loop, 'into')
    const own = Array.from({ length: last - first + 1 }, (_, i) => first + i)
    loop.reach = [...new Set([...own, ...loop.below.flatMap((other) => other.reach)])]
    loop.budget = add(loop.cross, extent(END_GAP, [thickness]))
    loops.push(loop)
  }
  return loops
}

/**
 * @param borderSpace - room between a node edge and a flow, in pixels
 */
export function planLaneSpace(plan: Plan, borderSpace: number): LaneSpace {
  const loops = buildLoops(plan)
  const count = plan.maxColumn + 1
  /**
   * How far the turns stick out at one end of a column: the band, the radius
   * and the loops it goes around, of the loop that turns there and reaches furthest.
   */
  const turn = (column: number, end: 'into' | 'out', ...more: Extent[]) => {
    const loop = highest(
      loops.filter((other) => (end === 'out' ? other.last : other.first) === column),
      end
    )
    return loop
      ? add(extent(loop.clear + EDGE_GAP, [loop.thickness]), loop[end], ...more)
      : extent()
  }
  const border = extent(0, [], borderSpace)
  return {
    columns: Array.from({ length: count }, (_, column) =>
      loops.filter((loop) => loop.reach.includes(column)).map((loop) => loop.budget)
    ),
    // With loops every gap keeps a minimum run for the flows between the columns
    // and holds the turns of the loops that leave or enter the columns next to it.
    gaps: Array.from({ length: plan.maxColumn }, (_, g) =>
      add(extent(loops.length ? MIN_RUN : 0), turn(g, 'out'), turn(g + 1, 'into'))
    ),
    lead: turn(0, 'into', border),
    loops,
    trail: turn(count - 1, 'out', border),
  }
}
