/**
 * The fixed numbers of the layout: lengths in CSS pixels, shares, and the
 * numbers of passes of the iterative steps. None of them is an option.
 */

// -- back flows (lane-space.ts) ---------------------------------------------

/** Inner radius of the turns of a back flow. */
export const CORNER = 6
/**
 * Inner radius of the turns of a flow from a node to itself. The loop wraps
 * around a single node, so without this the band is much wider than the hole
 * it leaves and reads as a disc.
 */
export const SELF_CORNER = 24
/** Shortest distance from the content to the first lane (a turn needs twice its radius across). */
export const FIRST_GAP = 14
/** Distance between two lanes. */
export const LANE_GAP = 6
/** Distance from the last lane to the end of the axis. */
export const END_GAP = 4
/** Spare room between the outer edge of a turn and the next thing along the column axis. */
export const EDGE_GAP = 2
/** Room kept between two neighbouring columns for the flows between them, when there are lanes. */
export const MIN_RUN = 40
/** Thinnest a lane or a back flow is drawn, so that none vanishes on a small chart. */
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
/** Passes of the placement: forward, backward, forward, backward. */
export const PASSES = 4
/** Passes that move the slots towards their flows once the flows that skip columns are level. */
export const STRAIGHTEN_PASSES = 8

// -- order (order.ts) -------------------------------------------------------

/** Rounds of one forward and one backward sweep of the node order. */
export const ROUNDS = 4
