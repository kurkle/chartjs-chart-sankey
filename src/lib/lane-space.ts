import type { Plan, PlanLink } from './topology.js'

/**
 * The room the lanes of the back flows take, written as budgets for the one
 * scale solve (see geometry.ts). Every loop takes room only in the columns it
 * runs under (and those of the loops it stacks on), and loops that do not
 * overlap share a level, so the room is a skyline over the columns, not one
 * stack for the whole chart. Every length is an `Extent`: pixels that do
 * not depend on the scale plus terms that grow with it, so a constraint on an
 * axis stays linear in the scale `k` (pixels per flow unit).
 */

/** Inner radius of the turns, in CSS pixels. */
export const CORNER = 6
/**
 * Inner radius of the turns of a flow from a node to itself. The loop wraps
 * around a single node, so without this the band is much wider than the hole
 * it leaves and reads as a disc.
 */
export const SELF_CORNER = 24
/** Shortest distance from the content to the first lane (a turn needs twice its radius across). */
const FIRST_GAP = 14
/** Distance between two lanes. */
const LANE_GAP = 6
/** Distance from the last lane to the end of the axis. */
const END_GAP = 4
/** Spare room between the outer edge of a turn and the next thing along the column axis. */
const EDGE_GAP = 2
/** Room kept between two neighbouring columns for the flows between them, when there are lanes. */
const MIN_RUN = 40
/** Thinnest a lane or a back flow is drawn, so that none vanishes on a small chart. */
export const MIN_THICKNESS = 1

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

/** Shortest distance from the content to a lane, before shrinking: a turn needs twice its radius across. */
export const firstGapOf = (clear: number) => Math.max(FIRST_GAP, 2 * clear)

/** Inner radius of the turns of a back flow, before shrinking. */
export const clearanceOf = (link: Pick<PlanLink, 'from' | 'to'>) =>
  link.from === link.to ? SELF_CORNER : CORNER

export interface Loop {
  /** Position in the nesting order, same as `link.lane` */
  rank: number
  link: PlanLink
  /** Target column and source column */
  first: number
  last: number
  /** inner radius of the turns, before shrinking */
  clear: number
  /** Thickness of the lane band */
  thickness: Term
  /** The loops this one stacks on: those before it that overlap it, in the nesting order */
  below: number[]
  /** Distance from the content to the lane, in pixels before shrinking: the first gap and the gaps of the loops below */
  lift: number
  /** The thicknesses of the loops under this one, in the chain that is the highest */
  chain: Term[]
  /** The same for the turns at the source end and at the target end: only loops that turn in the same gap count */
  out: { chain: Term[]; lift: number }
  into: { chain: Term[]; lift: number }
  /** Columns whose content this loop's position depends on */
  reach: Set<number>
  /** What the loop takes of the cross axis in a column it reaches: gaps and thickness */
  stack: Extent
}

export interface LaneSpace {
  loops: Loop[]
  /** distance from the last lane to the end of the axis, before shrinking */
  endGap: number
  /** by column, the stacks of the loops that reach it */
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
export const overlaps = (a: Pick<Loop, 'first' | 'last'>, b: Pick<Loop, 'first' | 'last'>) =>
  a.last + 1 >= b.first && b.last + 1 >= a.first

const units = (terms: Term[]) => terms.reduce((sum, term) => sum + term.size, 0)

/** Of the loops, the one whose chain of thicknesses is the longest, to stack on. */
function highest(loops: Loop[], chainOf: (loop: Loop) => Term[]): Loop | undefined {
  let best: Loop | undefined
  for (const loop of loops) {
    if (!best || units(chainOf(loop)) + loop.link.flow >= units(chainOf(best)) + best.link.flow) {
      best = loop
    }
  }
  return best
}

export const gapBelow = (below: Loop, loop: Loop) =>
  LANE_GAP + Math.max(0, below.clear - loop.clear)

/** The loops under `loop` that turn in the same gap at one end, and what that stacks on the end. */
function stackAtEnd(loop: Loop, under: Loop[], end: 'into' | 'out') {
  const sharing = under.filter((other) =>
    end === 'out' ? other.link.from === loop.link.from : other.link.to === loop.link.to
  )
  const top = highest(sharing, (other) => other[end].chain)
  if (top) loop[end].chain = [...top[end].chain, top.thickness]
  for (const other of sharing) {
    loop[end].lift = Math.max(loop[end].lift, other[end].lift + gapBelow(other, loop))
  }
}

/**
 * The loops in nesting order, each with the room it needs: the thicknesses of
 * the loops under it (the highest chain, so every sum stays linear in the
 * scale) and the fixed gaps.
 */
function buildLoops(plan: Plan): Loop[] {
  const loops: Loop[] = []
  for (const lane of plan.lanes) {
    const { link } = lane
    const clear = clearanceOf(link)
    const loop: Loop = {
      below: [],
      chain: [],
      clear,
      first: lane.first,
      into: { chain: [], lift: 0 },
      last: lane.last,
      lift: firstGapOf(clear),
      link,
      out: { chain: [], lift: 0 },
      rank: loops.length,
      reach: new Set(),
      stack: empty(),
      thickness: { min: MIN_THICKNESS, size: link.flow },
    }
    const under = loops.filter((other) => overlaps(other, loop))
    loop.below = under.map((other) => other.rank)
    const base = highest(under, (other) => other.chain)
    if (base) loop.chain = [...base.chain, base.thickness]
    for (const other of under) loop.lift = Math.max(loop.lift, other.lift + gapBelow(other, loop))
    for (const end of ['out', 'into'] as const) stackAtEnd(loop, under, end)
    for (let column = loop.first; column <= loop.last; column++) loop.reach.add(column)
    for (const other of under) for (const column of other.reach) loop.reach.add(column)
    loop.stack = {
      rigid: 0,
      shrinkable: loop.lift + END_GAP,
      terms: [...loop.chain, loop.thickness],
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
  const result: (Loop | undefined)[] = new Array(columns).fill(undefined)
  for (const loop of loops) {
    const column = end === 'out' ? loop.last : loop.first
    const best = result[column]
    if (
      !best ||
      units(loop[end].chain) + loop.link.flow > units(best[end].chain) + best.link.flow
    ) {
      result[column] = loop
    }
  }
  return result
}

/**
 * @param borderSpace - room between a node edge and a flow, in pixels
 */
export function planLaneSpace(plan: Plan, borderSpace: number): LaneSpace {
  const loops = buildLoops(plan)
  const columns = plan.maxColumn + 1
  const stacks: Extent[][] = Array.from({ length: columns }, () => [])
  for (const loop of loops) {
    for (const column of loop.reach) stacks[column].push(loop.stack)
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
    endGap: END_GAP,
    gaps,
    lead: into[0] ? add(turn(into[0], 'into'), border) : empty(),
    loops,
    trail: out[columns - 1] ? add(turn(out[columns - 1], 'out'), border) : empty(),
  }
}
