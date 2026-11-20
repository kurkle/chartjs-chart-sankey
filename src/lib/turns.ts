import type { Plan, PlanHook, PlanLink, PlanSlot } from './topology.js'

import { CORNER, EDGE_GAP, MIN_RUN, MIN_THICKNESS, SELF_CORNER, TURN_GAP } from './constants.js'

/**
 * The room the turns of the back flows take on the column axis, written as
 * budgets for the one scale solve (see geometry.ts). A back flow turns beside
 * its source column and beside its target column; turns that nest take room one
 * beside the other, turns that do not share it. Every length is an `Extent`:
 * pixels that do not depend on the scale plus terms that grow with it, so a
 * constraint on an axis stays linear in the scale `k` (pixels per flow unit).
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

/** What a turn stands on: the thicknesses of the turns it goes around (the chain that is the highest, so every sum stays linear in the scale) and the fixed gaps. */
export interface Turn {
  hook: PlanHook
  /** inner radius of the corners, before shrinking */
  clear: number
  thickness: Term
  chain: Term[]
  /** pixels before shrinking */
  lift: number
}

export interface TurnSpace {
  turns: Map<PlanHook, Turn>
  /** on the column axis: before the first column, after the last, and between neighbours */
  lead: Extent
  trail: Extent
  gaps: Extent[]
  /** what the turns beside each column take of the gap after it and of the gap before it */
  right: Extent[]
  left: Extent[]
}

/** Inner radius of the corners of a back flow, before shrinking. */
export const clearanceOf = (link: Pick<PlanLink, 'from' | 'to'>) =>
  link.from === link.to ? SELF_CORNER : CORNER

const units = (turn: Turn) =>
  turn.chain.reduce((sum, term) => sum + term.size, 0) + turn.thickness.size

/** Of the turns, the one that reaches furthest: the longest chain with its own thickness. */
function highest(turns: Turn[]): Turn | undefined {
  let best: Turn | undefined
  for (const turn of turns) {
    if (!best || units(turn) >= units(best)) best = turn
  }
  return best
}

/** Distance between a turn and the one it goes around. */
const gapBelow = (below: Turn, turn: Turn) => TURN_GAP + Math.max(0, below.clear - turn.clear)

/** The turns beside one edge of a column, the ones that span the least first, each standing on the turns it goes around. */
function stackTurns(hooks: PlanHook[], at: (slot: PlanSlot) => number): Turn[] {
  const span = (hook: PlanHook): [number, number] => {
    const [x, y] = [at(hook.node), at(hook.slot)]
    return x < y ? [x, y] : [y, x]
  }
  const sorted = [...hooks].sort((a, b) => {
    const [sa, sb] = [span(a), span(b)]
    return sa[1] - sa[0] - (sb[1] - sb[0]) || a.link.index - b.link.index
  })
  const turns: Turn[] = []
  for (const hook of sorted) {
    const [lo, hi] = span(hook)
    const clear = clearanceOf(hook.link)
    const below = turns.filter((other) => {
      const [olo, ohi] = span(other.hook)
      return olo <= hi && lo <= ohi
    })
    const top = highest(below)
    let lift = 0
    for (const other of below)
      lift = Math.max(lift, other.lift + gapBelow(other, { clear } as Turn))
    turns.push({
      chain: top ? [...top.chain, top.thickness] : [],
      clear,
      hook,
      lift,
      thickness: { min: MIN_THICKNESS, size: hook.link.flow },
    })
  }
  return turns
}

/** How far the turns of an edge stick out from the node edge: the band, the radius, the turns it goes around. */
function turnExtent(turn: Turn | undefined): Extent {
  return turn
    ? {
        rigid: 0,
        shrinkable: turn.clear + turn.lift + EDGE_GAP,
        terms: [turn.thickness, ...turn.chain],
      }
    : empty()
}

/**
 * @param borderSpace - room between a node edge and a flow, in pixels
 */
export function planTurnSpace(plan: Plan, borderSpace: number): TurnSpace {
  const columns = plan.maxColumn + 1
  const at = new Map<PlanSlot, number>()
  for (const column of plan.slots) {
    column.forEach((slot, i) => {
      at.set(slot, i)
    })
  }
  const position = (slot: PlanSlot) => at.get(slot) as number
  const groups = new Map<string, PlanHook[]>()
  for (const hook of plan.hooks) {
    const key = `${hook.column}${hook.side}`
    groups.set(key, [...(groups.get(key) ?? []), hook])
  }
  const turns = new Map<PlanHook, Turn>()
  const outer = (side: 'left' | 'right') =>
    Array.from({ length: columns }, (_, column) => {
      const stacked = stackTurns(groups.get(`${column}${side}`) ?? [], position)
      for (const turn of stacked) turns.set(turn.hook, turn)
      return turnExtent(highest(stacked))
    })
  const right = outer('right')
  const left = outer('left')
  const border: Extent = { rigid: borderSpace, shrinkable: 0, terms: [] }

  // With back flows every gap keeps a minimum run for the flows between the columns
  // and holds the turns beside the columns next to it.
  const gaps: Extent[] = []
  for (let g = 0; g < plan.maxColumn; g++) {
    gaps.push(
      add(
        { rigid: 0, shrinkable: plan.hooks.length ? MIN_RUN : 0, terms: [] },
        add(right[g], left[g + 1])
      )
    )
  }
  return {
    gaps,
    lead: left[0].terms.length ? add(left[0], border) : empty(),
    left,
    right,
    trail: right[columns - 1].terms.length ? add(right[columns - 1], border) : empty(),
    turns,
  }
}
