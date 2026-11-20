import type { Plan, PlanLane, PlanLink } from './topology.js'

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
 * stack for the whole chart. Every length is an `Extent`: pixels that do
 * not depend on the scale plus terms that grow with it, so a constraint on an
 * axis stays linear in the scale `k` (pixels per flow unit).
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

/** `rigid` pixels, `shrinkable` pixels (scaled by the common factor) and terms that grow with the scale. */
export interface Extent {
  rigid: number
  shrinkable: number
  terms: Term[]
}

const empty = (): Extent => ({ rigid: 0, shrinkable: 0, terms: [] })

export const termPixels = (term: Term, k: number, factor: number) =>
  Math.max(k * term.size, term.min * factor)

/** The terms with their minimum shrunk by the factor, for the scale solve. */
export const shrinkTerms = (terms: Term[], factor: number): Term[] =>
  terms.map((term) => ({ min: term.min * factor, size: term.size }))

/** Pixels an extent takes at the least, before shrinking: its fixed ones and the minimums of its terms. */
export const floor = (extent: Extent): number =>
  extent.shrinkable + extent.terms.reduce((sum, term) => sum + term.min, 0)

/** The length of the extent for scale `k` and shrink factor `factor`. */
export const measure = (extent: Extent, k: number, factor: number): number =>
  extent.rigid +
  factor * extent.shrinkable +
  extent.terms.reduce((sum, term) => sum + termPixels(term, k, factor), 0)

const add = (a: Extent, b: Extent): Extent => ({
  rigid: a.rigid + b.rigid,
  shrinkable: a.shrinkable + b.shrinkable,
  terms: [...a.terms, ...b.terms],
})

/**
 * What a loop stacks on at one place: the thicknesses of the loops under it (the
 * chain that is the highest, so every sum stays linear in the scale) and the
 * fixed gaps. The stack of the cross axis counts every loop it overlaps; the
 * stacks at the source end and at the target end only the loops that turn in
 * the same gap.
 */
export interface Stack {
  chain: Term[]
  /** pixels before shrinking */
  lift: number
}

export interface Loop {
  lane: PlanLane
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
  /** Distance from the content to the lane: the first gap, the gaps of the loops below and their thicknesses */
  cross: Stack
  /** The turn at the source end and at the target end */
  out: Stack
  into: Stack
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

type StackName = 'cross' | 'into' | 'out'

/**
 * Two loops cannot share a level when there is no whole column between them:
 * their turns live in the gaps next to the columns, and would meet.
 */
const overlaps = (a: Pick<Loop, 'first' | 'last'>, b: Pick<Loop, 'first' | 'last'>) =>
  a.last + 1 >= b.first && b.last + 1 >= a.first

/** Which of the loops under `loop` count for a stack. */
const shares: Record<StackName, (other: Loop, loop: Loop) => boolean> = {
  cross: () => true,
  into: (other, loop) => other.link.to === loop.link.to,
  out: (other, loop) => other.link.from === loop.link.from,
}

const units = (terms: Term[]) => terms.reduce((sum, term) => sum + term.size, 0)

/** Of the loops, the one that reaches furthest in a stack: the longest chain with its own thickness. */
function highest(loops: Loop[], name: StackName): Loop | undefined {
  let best: Loop | undefined
  for (const loop of loops) {
    if (
      !best ||
      units(loop[name].chain) + loop.link.flow >= units(best[name].chain) + best.link.flow
    ) {
      best = loop
    }
  }
  return best
}

const gapBelow = (below: Loop, loop: Loop) => LANE_GAP + Math.max(0, below.clear - loop.clear)

/** Shortest distance from the content to a lane, before shrinking: a turn needs twice its radius across. */
const firstGapOf = (clear: number) => Math.max(FIRST_GAP, 2 * clear)

/** Inner radius of the turns of a back flow, before shrinking. */
export const clearanceOf = (link: Pick<PlanLink, 'from' | 'to'>) =>
  link.from === link.to ? SELF_CORNER : CORNER

function stackOn(loop: Loop, name: StackName): Stack {
  const sharing = loop.below.filter((other) => shares[name](other, loop))
  const top = highest(sharing, name)
  let lift = name === 'cross' ? firstGapOf(loop.clear) : 0
  for (const other of sharing) lift = Math.max(lift, other[name].lift + gapBelow(other, loop))
  return { chain: top ? [...top[name].chain, top.thickness] : [], lift }
}

/**
 * The loops in nesting order, each with the room it needs.
 */
function buildLoops(plan: Plan): Loop[] {
  const loops: Loop[] = []
  for (const lane of plan.lanes) {
    const { link } = lane
    const loop = {
      clear: clearanceOf(link),
      first: lane.first,
      lane,
      last: lane.last,
      link,
      thickness: { min: MIN_THICKNESS, size: link.flow },
    } as Loop
    loop.below = loops.filter((other) => overlaps(other, loop))
    loop.cross = stackOn(loop, 'cross')
    loop.out = stackOn(loop, 'out')
    loop.into = stackOn(loop, 'into')
    const reach = new Set<number>()
    for (let column = loop.first; column <= loop.last; column++) reach.add(column)
    for (const other of loop.below) for (const column of other.reach) reach.add(column)
    loop.reach = [...reach]
    loop.budget = {
      rigid: 0,
      shrinkable: loop.cross.lift + END_GAP,
      terms: [...loop.cross.chain, loop.thickness],
    }
    loops.push(loop)
  }
  return loops
}

/** How far the turns of a loop stick out from its node edge at one end: the band, the radius, the loops it goes around. */
function turnExtent(loop: Loop, end: 'into' | 'out'): Extent {
  return {
    rigid: 0,
    shrinkable: loop.clear + loop[end].lift + EDGE_GAP,
    terms: [loop.thickness, ...loop[end].chain],
  }
}

/** Of the loops that turn at a column, the one that reaches furthest. */
function outermost(loops: Loop[], columns: number, end: 'into' | 'out'): (Loop | undefined)[] {
  return Array.from({ length: columns }, (_, column) =>
    highest(
      loops.filter((loop) => (end === 'out' ? loop.last : loop.first) === column),
      end
    )
  )
}

/**
 * @param borderSpace - room between a node edge and a flow, in pixels
 */
export function planLaneSpace(plan: Plan, borderSpace: number): LaneSpace {
  const loops = buildLoops(plan)
  const columns = plan.maxColumn + 1
  const stacks: Extent[][] = Array.from({ length: columns }, () => [])
  for (const loop of loops) {
    for (const column of loop.reach) stacks[column].push(loop.budget)
  }

  const out = outermost(loops, columns, 'out')
  const into = outermost(loops, columns, 'into')
  const turn = (loop: Loop | undefined, end: 'into' | 'out') =>
    loop ? turnExtent(loop, end) : empty()
  const border: Extent = { rigid: borderSpace, shrinkable: 0, terms: [] }

  // With loops every gap keeps a minimum run for the flows between the columns
  // and holds the turns of the loops that leave or enter the columns next to it.
  const gaps: Extent[] = []
  for (let g = 0; g < plan.maxColumn; g++) {
    gaps.push(
      add(
        { rigid: 0, shrinkable: loops.length ? MIN_RUN : 0, terms: [] },
        add(turn(out[g], 'out'), turn(into[g + 1], 'into'))
      )
    )
  }
  return {
    columns: stacks,
    gaps,
    lead: into[0] ? add(turn(into[0], 'into'), border) : empty(),
    loops,
    trail: out[columns - 1] ? add(turn(out[columns - 1], 'out'), border) : empty(),
  }
}
