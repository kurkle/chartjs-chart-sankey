import type { Plan, PlanLink } from './topology.js'

/**
 * The room the lanes of the back flows take, written as budgets for the one
 * scale solve (see geometry.ts). Every length is an `Extent`: pixels that do
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

export interface LaneBox {
  /** inner radius of the turns, before shrinking */
  clear: number
  /** how much farther than the inner lane the turns stick out, before shrinking */
  lift: number
  /** thicknesses of the lanes inside this one */
  before: Term[]
  thickness: Term
}

export interface LaneSpace {
  lanes: LaneBox[]
  /** distance from the content to the first lane, before shrinking */
  firstGap: number
  /** distance from the last lane to the end of the axis, before shrinking */
  endGap: number
  /** on the cross axis, after the content: gaps and the thickness of all lanes */
  cross: Extent
  /** on the column axis: before the first column, after the last, and between neighbours */
  lead: Extent
  trail: Extent
  gaps: Extent[]
}

/** Inner radius of the turns of a back flow, before shrinking. */
export const clearanceOf = (link: Pick<PlanLink, 'from' | 'to'>) =>
  link.from === link.to ? SELF_CORNER : CORNER

/**
 * How far the turns of a flow stick out from its node edge: the band, the
 * radius, the inner lanes the turn has to go around.
 */
function turnExtent(link: PlanLink, lane: LaneBox): Extent {
  return {
    rigid: 0,
    shrinkable: clearanceOf(link) + lane.lift + EDGE_GAP,
    terms: [{ min: MIN_THICKNESS, size: link.flow }, ...lane.before],
  }
}

/** The flow of the outermost lane (the longest turn), the biggest first, for each column. */
function outermost(
  links: readonly PlanLink[],
  columns: number,
  end: 'from' | 'to'
): (PlanLink | undefined)[] {
  const result: (PlanLink | undefined)[] = new Array(columns).fill(undefined)
  for (const link of links) {
    const column = link[end].x ?? 0
    const best = result[column]
    if (!best || link.lane > best.lane || (link.lane === best.lane && link.flow > best.flow)) {
      result[column] = link
    }
  }
  return result
}

/**
 * @param borderSpace - room between a node edge and a flow, in pixels
 */
export function planLaneSpace(plan: Plan, borderSpace: number): LaneSpace {
  const lanes: LaneBox[] = []
  let before: Term[] = []
  plan.lanes.forEach((lane, rank) => {
    const clear = Math.max(...lane.links.map(clearanceOf))
    const inner = lanes[rank - 1]
    // an outer lane's turns also clear the hole of the lane inside it
    const lift = inner ? inner.lift + LANE_GAP + Math.max(0, inner.clear - clear) : 0
    const thickness = { min: MIN_THICKNESS, size: lane.thickness }
    lanes.push({ before, clear, lift, thickness })
    before = [...before, thickness]
  })

  const outer = lanes.at(-1)
  const firstGap = Math.max(FIRST_GAP, 2 * (lanes[0]?.clear ?? 0))
  const cross: Extent = outer
    ? { rigid: 0, shrinkable: firstGap + outer.lift + END_GAP, terms: before }
    : empty()

  const routed = plan.links.filter((link) => link.lane >= 0)
  const columns = plan.maxColumn + 1
  const out = outermost(routed, columns, 'from')
  const into = outermost(routed, columns, 'to')
  const extentOf = (link: PlanLink | undefined) =>
    link ? turnExtent(link, lanes[link.lane]) : empty()

  const first = into[0]
  const last = out[columns - 1]
  // With lanes every gap keeps a minimum run for the flows between the columns
  // and holds the turns of the back flows that leave or enter the columns next to it.
  const gaps: Extent[] = []
  for (let g = 0; g < plan.maxColumn; g++) {
    const turns = [out[g], into[g + 1]]
      .map(extentOf)
      .reduce((sum, extent) => add(sum, extent), empty())
    gaps.push(add({ rigid: 0, shrinkable: lanes.length ? MIN_RUN : 0, terms: [] }, turns))
  }
  return {
    cross,
    endGap: END_GAP,
    firstGap,
    gaps,
    lanes,
    lead: first ? add(extentOf(first), { rigid: borderSpace, shrinkable: 0, terms: [] }) : empty(),
    trail: last ? add(extentOf(last), { rigid: borderSpace, shrinkable: 0, terms: [] }) : empty(),
  }
}
