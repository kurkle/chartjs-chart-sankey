import type { FlowOptions } from './types.js'

import Flow from './flow.js'

function createContext() {
  return {
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    font: '',
    lineTo: vi.fn(),
    lineWidth: 0,
    measureText: vi.fn().mockReturnValue({ width: 14 } as TextMetrics),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
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

    expect(context.fillText).toHaveBeenCalledExactlyOnceWith('5', 50, 10)
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

  it('hits a flow that runs against the direction of the columns', () => {
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 110,
      x2: 10,
      y: 100,
      y2: 100,
    })

    // the band loops through the top of the canvas: y(t) = 100 (1 - t)^3 + 100 t^3
    // and u is linear in t, so the middle of the band is at y 25..35
    expect(flow.inRange(110, 105, false)).toBe(true)
    expect(flow.inRange(10, 105, false)).toBe(true)
    expect(flow.inRange(60, 30, false)).toBe(true)
    expect(flow.inRange(60, 100, false)).toBe(false)
    expect(flow.inRange(5, 105, false)).toBe(false)
  })

  it('hits a vertical flow that runs against the direction of the columns', () => {
    const options = createOptions('#123456')
    options.orientation = 'vertical'
    const flow = new Flow({
      flow: 5,
      height: 0,
      options,
      width: 10,
      x: 100,
      x2: 100,
      y: 110,
      y2: 10,
    })

    expect(flow.inRange(105, 110, false)).toBe(true)
    expect(flow.inRange(30, 60, false)).toBe(true)
    expect(flow.inRange(100 + 60, 60, false)).toBe(false)
  })

  it('does not hit above or below its ends along the columns', () => {
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 10,
      x2: 110,
      y: 10,
      y2: 10,
    })

    expect(flow.inRange(9, 15, false)).toBe(false)
    expect(flow.inRange(111, 15, false)).toBe(false)
  })
})
