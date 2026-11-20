import type { Route, SankeyOrientation, UW } from '../types.js'

/**
 * The finished route of a flow, in a coordinate system that does not depend on
 * the orientation: `u` runs along the columns and `w` across them. The layout
 * hands every flow one of these; the element draws it, tests where the mouse is
 * on it and animates it without knowing which way the chart runs. The only
 * place that does know is the frame, which maps (u, w) to x/y and back.
 */

export interface Frame {
  /** The point of the canvas at (u, w) */
  point(u: number, w: number): { x: number; y: number }
  /** The canvas rectangle with its corner at (u, w) and the given extent along u and across */
  rect(
    u: number,
    w: number,
    du: number,
    dw: number
  ): { height: number; width: number; x: number; y: number }
  /** (u, w) of a point of the canvas */
  uw(x: number, y: number): UW
  /** A gradient along u, from `u1` to `u2` */
  gradient(ctx: CanvasRenderingContext2D, u1: number, u2: number): CanvasGradient
}

/** In a horizontal chart u = x and w = y; in a vertical chart u = y and w = x. */
export const FRAMES: Record<SankeyOrientation, Frame> = {
  horizontal: {
    gradient: (ctx, u1, u2) => ctx.createLinearGradient(u1, 0, u2, 0),
    point: (u, w) => ({ x: u, y: w }),
    rect: (u, w, du, dw) => ({ height: dw, width: du, x: u, y: w }),
    uw: (x, y) => ({ u: x, w: y }),
  },
  vertical: {
    gradient: (ctx, u1, u2) => ctx.createLinearGradient(0, u1, 0, u2),
    point: (u, w) => ({ x: w, y: u }),
    rect: (u, w, du, dw) => ({ height: du, width: dw, x: w, y: u }),
    uw: (x, y) => ({ u: y, w: x }),
  },
}

const mix = (a: number, b: number, factor: number) => a + (b - a) * factor

/** Interpolates two routes for the animations; routes of different shapes switch in the middle. */
export function interpolateRoute(
  from: Route | undefined,
  to: Route | undefined,
  factor: number
): Route | undefined {
  if (!from || !to) return !from || factor > 0.5 ? to : from
  if (from.kind === 'band' && to.kind === 'band' && from.points.length === to.points.length) {
    return {
      kind: 'band',
      points: to.points.map((point, i) => ({
        u: mix(from.points[i].u, point.u, factor),
        w: mix(from.points[i].w, point.w, factor),
      })),
      t: mix(from.t, to.t, factor),
    }
  }
  if (from.kind === 'lane' && to.kind === 'lane') {
    return {
      c1: mix(from.c1, to.c1, factor),
      c2: mix(from.c2, to.c2, factor),
      kind: 'lane',
      lane: mix(from.lane, to.lane, factor),
      radius: mix(from.radius, to.radius, factor),
      reach1: mix(from.reach1, to.reach1, factor),
      reach2: mix(from.reach2, to.reach2, factor),
      t: mix(from.t, to.t, factor),
      u1: mix(from.u1, to.u1, factor),
      u2: mix(from.u2, to.u2, factor),
    }
  }
  return factor > 0.5 ? to : from
}
