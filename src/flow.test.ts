import type { FlowOptions, Route, UW } from './types.js'

import Flow, { interpolateRoute } from './flow.js'

function createContext() {
  return {
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    font: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineTo: vi.fn(),
    lineWidth: 0,
    measureText: vi.fn().mockReturnValue({ width: 14 } as TextMetrics),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

function createOptions(flowColor: string | null = null): FlowOptions {
  return {
    alpha: 0.5,
    colorFrom: 'red',
    colorMode: 'gradient',
    colorTo: 'green',
    flowColor,
    flowLabels: {
      borderRadius: 0,
      color: 'black',
      display: false,
      padding: 4,
      position: 'center',
    },
    hoverColorFrom: 'red',
    hoverColorTo: 'green',
    orientation: 'horizontal',
  }
}

// u runs along the columns, w across them
const BAND = { thickness: 12, u: 20, u2: 320, w: 15, w2: 215 }

function createBand(orientation: 'horizontal' | 'vertical') {
  const options = createOptions('#123456')
  options.orientation = orientation
  const { thickness, u, u2, w, w2 } = BAND
  if (orientation === 'vertical') {
    const flow = new Flow({
      flow: 5,
      height: 0,
      options,
      width: thickness,
      x: w,
      x2: w2,
      y: u,
      y2: u2,
    })
    return { at: (mu: number, mw: number) => flow.inRange(mw, mu, false), flow }
  }
  const flow = new Flow({ flow: 5, height: thickness, options, x: u, x2: u2, y: w, y2: w2 })
  return { at: (mu: number, mw: number) => flow.inRange(mu, mw, false), flow }
}

describe('Flow', () => {
  it('uses flowColor independently from its node colors', () => {
    const context = createContext()
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 0,
      x2: 100,
      y: 0,
      y2: 10,
    })

    flow.draw(context)

    expect(context.fillStyle).toBe('#123456')
    expect(context.strokeStyle).toBe('#123456')
    expect(flow.options.colorFrom).toBe('red')
    expect(flow.options.colorTo).toBe('green')
  })

  it('draws the flow value using the configured label options', () => {
    const context = createContext()
    const options = createOptions('red')
    options.flowLabels = {
      backgroundColor: 'white',
      borderRadius: 0,
      color: 'black',
      display: true,
      padding: 4,
      position: 'center',
    }
    const flow = new Flow({ flow: 5, height: 10, options, x: 0, x2: 100, y: 0, y2: 10 })

    flow.draw(context)

    expect(context.fillText).toHaveBeenCalledExactlyOnceWith('5', 50, 10, undefined)
    expect(context.fillRect).toHaveBeenCalled()
  })

  it('draws and interacts with a vertical flow', () => {
    const context = createContext()
    const options = createOptions('#123456')
    options.orientation = 'vertical'
    const flow = new Flow({
      flow: 5,
      height: 0,
      options,
      width: 8,
      x: 10,
      x2: 30,
      y: 20,
      y2: 120,
    })

    flow.draw(context)

    expect(context.moveTo).toHaveBeenCalledWith(10, 20)
    expect(context.lineTo).toHaveBeenCalledWith(38, 120)
    expect(flow.inRange(24, 70, false)).toBe(true)
    expect(flow.inRange(35, 70, false)).toBe(false)
    expect(flow.getCenterPoint(false)).toEqual({ x: 24, y: 70 })
  })

  it('hits a horizontal flow where the curve runs, not on the straight line between its ends', () => {
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 10,
      x2: 110,
      y: 10,
      y2: 110,
    })

    // a quarter of the way along the columns the curve has crossed only 7% of the way
    // between the rows, so its band is at y 17..27; a linear parameter put it at y 35..45
    expect(flow.inRange(35, 10 + 100 * 0.15, false)).toBe(true)
    expect(flow.inRange(35, 10 + 100 * 0.15 + 20, false)).toBe(false)
    expect(flow.inRange(35, 10 + 100 * 0.25 + 5, false)).toBe(false)
    expect(flow.inRange(60, 65, false)).toBe(true)
  })

  it.each(['horizontal', 'vertical'] as const)(
    'finds the edge of a %s band within 0.01 px along the whole curve',
    (orientation) => {
      const { at, flow } = createBand(orientation)
      for (let i = 1; i < 200; i++) {
        const t = i / 200
        const mu = BAND.u + (BAND.u2 - BAND.u) * (2 * t - 3 * t * t + 2 * t * t * t)
        const edge = BAND.w + (BAND.w2 - BAND.w) * (3 * t * t - 2 * t * t * t)
        const answers = [edge - 0.01, edge + 0.01, edge + 12 - 0.01, edge + 12 + 0.01].map((mw) =>
          at(mu, mw)
        )
        expect(answers).toEqual([false, true, true, false])
      }
      expect(flow.inRange(-100, -100, false)).toBe(false)
    }
  )

  it('does not hit above or below its ends along the columns', () => {
    const { at } = createBand('horizontal')
    expect(at(BAND.u - 1, BAND.w + 5)).toBe(false)
    expect(at(BAND.u2 + 1, BAND.w2 + 5)).toBe(false)
  })

  it('hits a flow that was made without a chart', () => {
    // no context, no controller: the answer comes from the route alone
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions(),
      x: 0,
      x2: 100,
      y: 0,
      y2: 0,
    })
    expect(flow.inRange(50, 5, false)).toBe(true)
    expect(flow.inRange(50, 15, false)).toBe(false)
  })

  describe('forward route with skipped columns', () => {
    // curve 0..100, straight run 100..200 across a skipped column, curve 200..300
    const route = {
      points: [
        { u: 0, w: 0 },
        { u: 100, w: 40 },
        { u: 200, w: 40 },
        { u: 300, w: 100 },
      ],
      t: 10,
    }
    const band = () =>
      new Flow({
        flow: 1,
        height: 10,
        options: createOptions(),
        route,
        x: 0,
        x2: 300,
        y: 0,
        y2: 100,
      })

    it('holds the straight run level', () => {
      const flow = band()
      expect(flow.inRange(150, 40, false)).toBe(true)
      expect(flow.inRange(150, 50, false)).toBe(true)
      expect(flow.inRange(150, 50.5, false)).toBe(false)
      expect(flow.inRange(150, 39.5, false)).toBe(false)
    })

    it('takes the curve of the segment that holds the mouse', () => {
      const flow = band()
      // the middle of a curve is half way across
      expect(flow.inRange(50, 20, false)).toBe(true)
      expect(flow.inRange(50, 19, false)).toBe(false)
      expect(flow.inRange(250, 70, false)).toBe(true)
      expect(flow.inRange(250, 69, false)).toBe(false)
    })

    it('meets itself at the ends of the segments', () => {
      const flow = band()
      for (const [u, w] of [
        [100, 40],
        [200, 40],
        [0, 0],
        [300, 100],
      ]) {
        expect(flow.inRange(u, w + 1, false)).toBe(true)
        expect(flow.inRange(u, w - 1, false)).toBe(false)
      }
    })
  })

  describe('back flow route', () => {
    // the lane of the fixture below: the radius is 16, the thickness 20
    const lane = (radius2?: number) =>
      new Flow({
        back: true,
        flow: 5,
        height: 20,
        options: createOptions(),
        route: {
          points: [
            { u: 300, w: 50 },
            { u: 326, w: 50 },
            { u: 326, w: 200 },
            { u: 74, w: 200 },
            { u: 74, w: 60 },
            { u: 100, w: 60 },
          ],
          radius: 16,
          radius2,
          t: 20,
        },
        width: 0,
        x: 300,
        x2: 100,
        y: 40,
        y2: 50,
      })

    it('has butt ends: nothing beyond the points that the route starts and ends at', () => {
      const flow = lane()
      expect(flow.inRange(301, 50, false)).toBe(true)
      expect(flow.inRange(299, 50, false)).toBe(false)
      expect(flow.inRange(100, 60, false)).toBe(true)
      expect(flow.inRange(99, 60, false)).toBe(true)
      // the stub reaches the node, not past it
      expect(flow.inRange(101, 60, false)).toBe(false)
      expect(flow.inRange(100, 71, false)).toBe(false)
    })

    it('rounds the corner with the arc, not with the corner point', () => {
      const flow = lane()
      // the corner is at (326, 50), the arc center at (310, 66) with radius 16 and a half stroke of 10
      expect(flow.inRange(310 + 16 * Math.SQRT1_2, 66 - 16 * Math.SQRT1_2, false)).toBe(true)
      // 10 outside the arc is still stroke, 11 is not
      const outward = (d: number) => [310 + d * Math.SQRT1_2, 66 - d * Math.SQRT1_2] as const
      expect(flow.inRange(...outward(16 + 9.9), false)).toBe(true)
      expect(flow.inRange(...outward(16 + 10.1), false)).toBe(false)
      expect(flow.inRange(...outward(16 - 9.9), false)).toBe(true)
      // the other side of the arc center is not on the arc
      expect(flow.inRange(310 - 16 * Math.SQRT1_2, 66 + 16 * Math.SQRT1_2, false)).toBe(false)
    })

    it('does not count the straight runs at the corners twice or leave a gap', () => {
      const flow = lane()
      // where the run along the lane ends and the arc begins, on the tangent points
      expect(flow.inRange(326, 66, false)).toBe(true)
      expect(flow.inRange(316, 50, false)).toBe(true)
      expect(flow.inRange(316, 60.1, false)).toBe(true)
      expect(flow.inRange(335.9, 100, false)).toBe(true)
      expect(flow.inRange(336.1, 100, false)).toBe(false)
    })

    it('goes round the turns at the target with the second radius', () => {
      // the corner at (74, 200) with radius 60 has its arc center at (134, 140)
      const point = [134 - 60 * Math.SQRT1_2, 140 + 60 * Math.SQRT1_2] as const
      expect(lane(60).inRange(...point, false)).toBe(true)
      // with the first radius the same point is clear of the stroke
      expect(lane().inRange(...point, false)).toBe(false)
    })

    it('joins a bare corner round', () => {
      const flow = new Flow({
        back: true,
        flow: 1,
        height: 20,
        options: createOptions(),
        route: {
          points: [
            { u: 0, w: 0 },
            { u: 100, w: 0 },
            { u: 100, w: 100 },
            { u: 0, w: 100 },
          ],
          radius: 0,
          t: 20,
        },
        x: 0,
        x2: 0,
        y: 0,
        y2: 100,
      })
      expect(flow.inRange(107, 0, false)).toBe(true)
      expect(flow.inRange(107, -7, false)).toBe(true)
      expect(flow.inRange(109, -9, false)).toBe(false)
    })
  })

  describe('hit area', () => {
    const band = (height: number) =>
      new Flow({ flow: 1, height, options: createOptions(), x: 0, x2: 100, y: 50, y2: 50 })

    it('is the band for a flow of three pixels or more, and measures the distance to it', () => {
      const flow = band(4)
      expect(flow.distance(50, 52, false)).toBe(0)
      expect(flow.distance(50, 50, false)).toBe(0)
      expect(flow.inRange(50, 54.01, false)).toBe(false)
      expect(flow.inRange(50, 53.99, false)).toBe(true)
      expect(flow.inRange(50, 49.99, false)).toBe(false)
      // far from the band, nothing is measured
      expect(flow.distance(50, 56, false)).toBe(Number.POSITIVE_INFINITY)
    })

    it('reaches a pixel and a half from the center line of a thin flow', () => {
      const flow = band(0.4)
      // the center line is at y 50.2: the area is 3 pixels across, centered on the band
      expect(flow.inRange(50, 50.2 + 1.49, false)).toBe(true)
      expect(flow.inRange(50, 50.2 - 1.49, false)).toBe(true)
      expect(flow.inRange(50, 50.2 + 1.51, false)).toBe(false)
      expect(flow.inRange(50, 50.2 - 1.51, false)).toBe(false)
      // but not beyond the ends of the flow by more than that
      expect(flow.inRange(101.2, 50.2, false)).toBe(true)
      expect(flow.inRange(101.4, 50.2, false)).toBe(false)
      expect(flow.distance(101, 50.2, false)).toBeCloseTo(1, 9)
      expect(flow.distance(50, 50.2 + 1, false)).toBeCloseTo(0.8, 9)
    })

    it('measures across a sloping band, not along the axis', () => {
      const flow = new Flow({
        flow: 1,
        height: 0.4,
        options: createOptions(),
        route: {
          points: [
            { u: 0, w: 0 },
            { u: 100, w: 100 },
          ],
          t: 0.4,
        },
        x: 0,
        x2: 100,
        y: 0,
        y2: 100,
      })
      // in the middle the curve is steepest: its slope across the columns is 3 * dw / du = 3
      const edge = 50
      const across = 1 / Math.sqrt(1 + 3 * 3)
      expect(flow.distance(50, edge + 0.4 + 1, false)).toBeCloseTo(across, 6)
    })

    it('measures the distance to a lane from its stroke', () => {
      const flow = new Flow({
        back: true,
        flow: 1,
        height: 0.5,
        options: createOptions(),
        route: {
          points: [
            { u: 100, w: 20 },
            { u: 110, w: 20 },
            { u: 110, w: 80 },
            { u: 20, w: 80 },
            { u: 20, w: 30 },
            { u: 30, w: 30 },
          ],
          radius: 4,
          t: 0.5,
        },
        width: 0,
        x: 100,
        x2: 30,
        y: 20,
        y2: 30,
      })
      expect(flow.distance(60, 80, false)).toBe(0)
      expect(flow.distance(60, 81, false)).toBeCloseTo(0.75, 9)
      expect(flow.inRange(60, 81.2, false)).toBe(true)
      expect(flow.inRange(60, 81.6, false)).toBe(false)
      // the middle of the arc of a corner at (110, 80) with radius 4: its center is at (106, 76)
      expect(flow.distance(106 + 4 * Math.SQRT1_2, 76 + 4 * Math.SQRT1_2, false)).toBe(0)
      expect(flow.distance(106 + 5 * Math.SQRT1_2, 76 + 5 * Math.SQRT1_2, false)).toBeCloseTo(
        1 - 0.25,
        9
      )
      expect(flow.distance(0, 0, false)).toBe(Number.POSITIVE_INFINITY)
    })
  })

  describe('back flow', () => {
    // source edge at x=300 / target edge at x=100, 20 thick, lane centered at y=200
    const backFlow = (
      orientation: 'horizontal' | 'vertical' = 'horizontal',
      flowColor = '#123456'
    ) => {
      const options = createOptions(flowColor)
      options.orientation = orientation
      const horizontal = { height: 20, width: 0, x: 300, x2: 100, y: 40, y2: 50 }
      const vertical = { height: 0, width: 20, x: 40, x2: 50, y: 300, y2: 100 }
      // the same route in (u, w) for both orientations
      const route = {
        points: [
          { u: 300, w: 50 },
          { u: 326, w: 50 },
          { u: 326, w: 200 },
          { u: 74, w: 200 },
          { u: 74, w: 60 },
          { u: 100, w: 60 },
        ],
        radius: 16,
        t: 20,
      }
      return new Flow({
        back: true,
        flow: 5,
        options,
        route,
        ...(orientation === 'vertical' ? vertical : horizontal),
      })
    }

    it('strokes a constant thickness band around the content', () => {
      const context = createContext()
      backFlow().draw(context)

      expect(context.moveTo).toHaveBeenCalledWith(300, 50)
      // four turns, then the end of the target stub
      expect(context.arcTo).toHaveBeenCalledTimes(4)
      expect(context.lineTo).toHaveBeenLastCalledWith(100, 60)
      expect(context.lineWidth).toBe(20)
      expect(context.stroke).toHaveBeenCalledTimes(1)
      expect(context.fill).not.toHaveBeenCalled()
      expect(context.setLineDash).not.toHaveBeenCalled()
    })

    it('reveals the band along its length while animating progress', () => {
      const context = createContext()
      const flow = backFlow()
      flow.progress = 0.5
      flow.draw(context)

      const [shown, total] = (context.setLineDash as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(shown).toBeGreaterThan(0)
      expect(shown).toBeCloseTo((total - 1) / 2, 8)
    })

    it('draws nothing before the animation starts', () => {
      const context = createContext()
      const flow = backFlow()
      flow.progress = 0
      flow.draw(context)
      expect(context.stroke).not.toHaveBeenCalled()
    })

    it('hits the band but not the area it goes around', () => {
      const flow = backFlow()
      expect(flow.inRange(200, 205, false)).toBe(true) // lane
      expect(flow.inRange(200, 120, false)).toBe(false) // inside the loop
      expect(flow.inRange(200, 60, false)).toBe(false) // the area the old curve crossed
      expect(flow.inRange(150, 55, false)).toBe(false) // between the nodes, on the straight line
    })

    it('has its center point on the lane', () => {
      const flow = backFlow()
      const center = flow.getCenterPoint(false)
      expect(center.y).toBe(200)
      expect(flow.inRange(center.x, center.y, false)).toBe(true)
      expect(flow.tooltipPosition()).toEqual(center)
    })

    it('covers the lane and the turns in x and y ranges', () => {
      const flow = backFlow()
      expect(flow.inYRange(205, false)).toBe(true)
      expect(flow.inYRange(250, false)).toBe(false)
      expect(flow.inXRange(70, false)).toBe(true)
      expect(flow.inXRange(60, false)).toBe(false)
      expect(flow.inXRange(500, false)).toBe(false)
    })

    it('draws the value label on the lane', () => {
      const context = createContext()
      const flow = backFlow()
      flow.options.flowLabels = { ...flow.options.flowLabels, color: 'black', display: true }
      flow.draw(context)
      const [, , y] = (context.fillText as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(y).toBeGreaterThan(190)
      expect(y).toBeLessThan(210)
    })

    it('works the same way transposed in a vertical chart', () => {
      const context = createContext()
      const flow = backFlow('vertical')
      flow.draw(context)

      expect(context.moveTo).toHaveBeenCalledWith(50, 300)
      expect(context.arcTo).toHaveBeenCalledTimes(4)
      expect(context.lineTo).toHaveBeenLastCalledWith(60, 100)
      expect(flow.inRange(205, 200, false)).toBe(true) // lane, x is the cross axis
      expect(flow.inRange(120, 200, false)).toBe(false)
      const center = flow.getCenterPoint(false)
      expect(center.x).toBe(200)
      expect(flow.inRange(center.x, center.y, false)).toBe(true)
    })

    it('runs the gradient from the source edge to the target edge', () => {
      const addColorStop = vi.fn()
      const createLinearGradient = vi.fn().mockReturnValue({ addColorStop })
      const context = { ...createContext(), createLinearGradient } as CanvasRenderingContext2D
      const flow = backFlow('horizontal')
      flow.options.flowColor = null
      flow.draw(context)

      // source is at the larger x, so the gradient runs towards the left
      expect(createLinearGradient).toHaveBeenCalledWith(300, 0, 100, 0)
      expect(addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 0, 0, 0.5)')
      expect(addColorStop).toHaveBeenNthCalledWith(2, 1, 'rgba(0, 128, 0, 0.5)')
    })
  })
})

describe('interpolateRoute', () => {
  // A forward route is the exit of the source, an entry and an exit for every skipped
  // column, and the entry of the target. The columns stay where they are: the source
  // exits at u 0 and the target is entered at u 300.
  const direct: Route = {
    points: [
      { u: 0, w: 0 },
      { u: 300, w: 100 },
    ],
    t: 10,
  }
  // the same flow skipping the column at u 100..200
  const skipping: Route = {
    points: [
      { u: 0, w: 0 },
      { u: 100, w: 40 },
      { u: 200, w: 40 },
      { u: 300, w: 100 },
    ],
    t: 10,
  }
  const mixed = (from: Route, to: Route, factor: number) =>
    interpolateRoute(from, to, factor) as Route
  const inOrder = (points: UW[]) => points.every((p, i) => i === 0 || p.u >= points[i - 1].u)

  it('mixes a route of two points with one of four', () => {
    const half = mixed(direct, skipping, 0.5)
    expect(half.points).toHaveLength(4)
    expect(half).not.toBe(direct)
    expect(half).not.toBe(skipping)
  })

  it('starts from the shorter route with a pair of zero length', () => {
    // the pair of the skipping route has no place in the direct one, so it sits on the
    // point before it, the exit of the source: the first frame draws the direct route
    expect(mixed(direct, skipping, 0).points).toEqual([
      { u: 0, w: 0 },
      { u: 0, w: 0 },
      { u: 0, w: 0 },
      { u: 300, w: 100 },
    ])
  })

  it('keeps the points in order along the columns', () => {
    for (const factor of [0.25, 0.5, 0.75]) {
      expect(inOrder(mixed(direct, skipping, factor).points)).toBe(true)
      expect(inOrder(mixed(skipping, direct, factor).points)).toBe(true)
    }
  })

  it('keeps the place of the waypoint pair both routes have', () => {
    // columns at u 100..150 and 250..300; the source moves from u 0 to the column at
    // u 100..150, so the route stops skipping that column but still skips the other one
    const one: Route = {
      points: [
        { u: 150, w: 30 },
        { u: 250, w: 60 },
        { u: 300, w: 60 },
        { u: 400, w: 100 },
      ],
      t: 10,
    }
    const two: Route = {
      points: [
        { u: 0, w: 0 },
        { u: 100, w: 30 },
        { u: 150, w: 30 },
        { u: 250, w: 50 },
        { u: 300, w: 50 },
        { u: 400, w: 100 },
      ],
      t: 10,
    }
    for (const factor of [0.25, 0.5, 0.75]) {
      const { points } = mixed(one, two, factor)
      expect(points).toHaveLength(6)
      expect(inOrder(points)).toBe(true)
      expect([points[3].u, points[4].u]).toEqual([250, 300])
    }
    // the pair it lost sits on the start of the route, where the source is now
    expect(mixed(one, two, 0).points).toEqual([
      { u: 150, w: 30 },
      { u: 150, w: 30 },
      { u: 150, w: 30 },
      { u: 250, w: 60 },
      { u: 300, w: 60 },
      { u: 400, w: 100 },
    ])
  })

  describe('lines up the waypoint pairs', () => {
    // the longer route skips the columns at u 100..150 and 250..300
    const two: Route = {
      points: [
        { u: 0, w: 0 },
        { u: 100, w: 30 },
        { u: 150, w: 30 },
        { u: 250, w: 50 },
        { u: 300, w: 50 },
        { u: 400, w: 100 },
      ],
      t: 10,
    }
    const skippingAt = (u: number): Route => ({
      points: [
        { u: 0, w: 0 },
        { u, w: 30 },
        { u: 150, w: 30 },
        { u: 400, w: 100 },
      ],
      t: 10,
    })

    it('by their place, within a pixel', () => {
      // half a pixel off is the same column: the pair stays where it is
      expect(mixed(skippingAt(100.5), two, 0).points).toEqual([
        { u: 0, w: 0 },
        { u: 100.5, w: 30 },
        { u: 150, w: 30 },
        { u: 150, w: 30 },
        { u: 150, w: 30 },
        { u: 400, w: 100 },
      ])
      // two pixels off is not: the pair is taken for the last one of the longer route
      expect(mixed(skippingAt(102), two, 0).points).toEqual([
        { u: 0, w: 0 },
        { u: 0, w: 0 },
        { u: 0, w: 0 },
        { u: 102, w: 30 },
        { u: 150, w: 30 },
        { u: 400, w: 100 },
      ])
    })

    it('in order when as many are left in both', () => {
      // no pair of the longer route, at u 50..80 and 200..250, is at the place of the other
      const elsewhere: Route = {
        points: [
          { u: 0, w: 0 },
          { u: 50, w: 10 },
          { u: 80, w: 10 },
          { u: 200, w: 40 },
          { u: 250, w: 40 },
          { u: 400, w: 100 },
        ],
        t: 10,
      }
      expect(mixed(skippingAt(100), elsewhere, 0).points).toEqual([
        { u: 0, w: 0 },
        { u: 0, w: 0 },
        { u: 0, w: 0 },
        { u: 100, w: 30 },
        { u: 150, w: 30 },
        { u: 400, w: 100 },
      ])
    })

    it('and pads after the last pair of the shorter route', () => {
      // the second pair of the longer route is entered where the shorter one ends
      const past: Route = {
        points: [
          { u: 0, w: 0 },
          { u: 100, w: 30 },
          { u: 150, w: 30 },
          { u: 400, w: 60 },
          { u: 450, w: 60 },
          { u: 500, w: 100 },
        ],
        t: 10,
      }
      expect(mixed(skippingAt(100), past, 0).points).toEqual([
        { u: 0, w: 0 },
        { u: 100, w: 30 },
        { u: 150, w: 30 },
        { u: 150, w: 30 },
        { u: 150, w: 30 },
        { u: 400, w: 100 },
      ])
    })
  })

  it('mixes the thickness', () => {
    expect(mixed(direct, { ...skipping, t: 20 }, 0.5).t).toBe(15)
  })

  it('mirrors a long route to a short one', () => {
    for (const factor of [0.25, 0.5, 0.75]) {
      const back = mixed(skipping, direct, 1 - factor).points
      const forth = mixed(direct, skipping, factor).points
      expect(back).toHaveLength(4)
      back.forEach((p, i) => {
        expect(p.u).toBeCloseTo(forth[i].u, 9)
        expect(p.w).toBeCloseTo(forth[i].w, 9)
      })
    }
    expect(mixed(skipping, direct, 1).points).toEqual(mixed(direct, skipping, 0).points)
  })

  it('goes on from a route that is padded in the middle of a tween', () => {
    // a second update during the tween starts the next one from the route drawn then
    const half = mixed(direct, skipping, 0.5)
    expect(mixed(half, direct, 0).points).toEqual(half.points)
    for (const factor of [0.25, 0.5, 0.75]) {
      const { points } = mixed(half, direct, factor)
      expect(points).toHaveLength(4)
      expect(inOrder(points)).toBe(true)
    }
    expect(mixed(half, direct, 1).points).toEqual(mixed(direct, skipping, 0).points)
    // and to a route that skips one more column, at u 220..260
    const further: Route = {
      points: [
        { u: 0, w: 0 },
        { u: 100, w: 40 },
        { u: 200, w: 40 },
        { u: 220, w: 50 },
        { u: 260, w: 50 },
        { u: 300, w: 100 },
      ],
      t: 10,
    }
    for (const factor of [0.25, 0.5, 0.75]) {
      const { points } = mixed(half, further, factor)
      expect(points).toHaveLength(6)
      expect(inOrder(points)).toBe(true)
    }
  })

  it('switches between back routes with other turns in the middle', () => {
    const turns = (count: number): Route => ({
      points: Array.from({ length: count }, (_, i) => ({ u: i * 10, w: (i % 2) * 10 })),
      radius: 4,
      t: 2,
    })
    expect(interpolateRoute(turns(6), turns(4), 0.25)).toEqual(turns(6))
    expect(interpolateRoute(turns(6), turns(4), 0.75)).toEqual(turns(4))
  })

  it('mixes back routes with the same turns, and starts a flow without a route at its target', () => {
    const lane = (w: number, radius2?: number): Route => ({
      points: [
        { u: 300, w: 50 },
        { u: 326, w: 50 },
        { u: 326, w },
        { u: 74, w },
        { u: 74, w: 60 },
        { u: 100, w: 60 },
      ],
      radius: 16,
      radius2,
      t: 20,
    })
    // the turns at the target start from the first radius
    expect(interpolateRoute(lane(200), lane(300, 32), 0.5)).toEqual(lane(250, 24))
    expect(interpolateRoute(lane(200), lane(300), 0.5)?.radius2).toBeUndefined()
    expect(interpolateRoute(undefined, direct, 0.5)).toBe(direct)
    expect(interpolateRoute(direct, undefined, 0.25)).toBe(direct)
  })

  it('gives a route that a flow is hit on', () => {
    const flow = new Flow({
      flow: 1,
      height: 10,
      options: createOptions(),
      route: mixed(direct, skipping, 0.5),
      x: 0,
      x2: 300,
      y: 0,
      y2: 100,
    })
    // halfway the straight run is at u 50..100, level at w 20: the band is w 20..30
    expect(flow.inRange(75, 21, false)).toBe(true)
    expect(flow.inRange(75, 29, false)).toBe(true)
    expect(flow.inRange(75, 19, false)).toBe(false)
    expect(flow.inRange(75, 31, false)).toBe(false)
  })

  it('switches between a forward and a back route in the middle', () => {
    const lane: Route = {
      points: [
        { u: 300, w: 50 },
        { u: 326, w: 50 },
        { u: 326, w: 200 },
        { u: 74, w: 200 },
        { u: 74, w: 60 },
        { u: 100, w: 60 },
      ],
      radius: 16,
      t: 20,
    }
    expect(interpolateRoute(skipping, lane, 0.25)).toBe(skipping)
    expect(interpolateRoute(skipping, lane, 0.75)).toBe(lane)
  })
})
