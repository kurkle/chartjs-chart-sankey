import type { FlowOptions } from './types.js'

import Flow from './flow.js'

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
