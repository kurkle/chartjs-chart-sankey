/**
 * The fixed numbers of the layout: lengths in CSS pixels, shares, and the
 * numbers of passes of the iterative steps. None of them is an option.
 */

// -- back flows (turns.ts) ---------------------------------------------

/** Inner radius of the turns of a back flow. */
export const CORNER = 6
/**
 * Inner radius of the turns of a flow from a node to itself. The loop wraps
 * around a single node, so without this the band is much wider than the hole
 * it leaves and reads as a disc.
 */
export const SELF_CORNER = 24
/** Distance between two nested turns. */
export const TURN_GAP = 6
/** Spare room between the outer edge of a turn and the next thing along the column axis. */
export const EDGE_GAP = 2
/** Room kept between two neighbouring columns for the flows between them, when there are back flows. */
export const MIN_RUN = 40
/** Thinnest a back flow is drawn, so that none vanishes on a small chart. */
export const MIN_THICKNESS = 1

// -- geometry (geometry.ts) -------------------------------------------------

/** The gaps may take at most this share of the cross axis. */
export const MAX_GAP_SHARE = 0.5
/**
 * Gap between two neighbouring waypoints, in pixels, unless the nodes ask for
 * less (a chart with no gaps has none between its waypoints either). Next to a
 * node a waypoint keeps the gap that node asks for on that side.
 */
export const WAYPOINT_GAP = 2
/** Passes over all columns that straighten the flows once the columns are placed. */
export const PASSES = 2

// -- order (order.ts) -------------------------------------------------------

/** Rounds of one forward and one backward sweep of the node order. */
export const ROUNDS = 3
/** Passes of swapping neighbouring slots after every sweep of the node order. */
export const TRANSPOSE_PASSES = 3
/**
 * How much more a flow weighs, in the bend the placement tries to remove, along
 * the slots of a back flow than elsewhere: the chain of a back flow runs
 * straight across the columns where it can.
 */
export const CHAIN_WEIGHT = 4
