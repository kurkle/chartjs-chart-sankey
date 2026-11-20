import type { FlowOptions } from './types.js'

import { createCanvas } from '@napi-rs/canvas'

import Flow from './flow.js'

// the element asks a canvas whether a point is on its path
vi.stubGlobal('document', { createElement: () => createCanvas(1, 1) })

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
