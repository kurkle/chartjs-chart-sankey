import type { FlowOptions } from './types.js'

import { createCanvas } from '@napi-rs/canvas'

import Flow from './flow.js'

// the element asks the context of its chart whether a point is on its path
const canvasContext = () =>
  createCanvas(200, 200).getContext('2d') as unknown as CanvasRenderingContext2D

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
      ctx: canvasContext(),
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
      ctx: canvasContext(),
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

  it('hits a flow that runs against the direction of the columns', () => {
    const flow = new Flow({
      ctx: canvasContext(),
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 110,
      x2: 10,
      y: 100,
      y2: 100,
    })

    // the band loops through the top of the canvas, so the start of it is below the loop
    expect(flow.inRange(110, 105, false)).toBe(true)
    expect(flow.inRange(10, 105, false)).toBe(true)
    expect(flow.inRange(60, 150, false)).toBe(false)
  })

  it('does not hit anything without the context of a chart', () => {
    const flow = new Flow({
      flow: 5,
      height: 10,
      options: createOptions('#123456'),
      x: 0,
      x2: 100,
      y: 0,
      y2: 0,
    })

    expect(flow.inRange(50, 5, false)).toBe(false)
  })
})
