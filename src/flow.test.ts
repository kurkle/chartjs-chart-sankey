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
})
