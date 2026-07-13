import type { FlowOptions } from './types.js'

import Flow from './flow.js'

function createContext() {
  return {
    beginPath: jasmine.createSpy('beginPath'),
    bezierCurveTo: jasmine.createSpy('bezierCurveTo'),
    closePath: jasmine.createSpy('closePath'),
    fill: jasmine.createSpy('fill'),
    fillRect: jasmine.createSpy('fillRect'),
    fillStyle: '',
    fillText: jasmine.createSpy('fillText'),
    font: '',
    lineTo: jasmine.createSpy('lineTo'),
    lineWidth: 0,
    measureText: jasmine.createSpy('measureText').and.returnValue({ width: 14 } as TextMetrics),
    moveTo: jasmine.createSpy('moveTo'),
    restore: jasmine.createSpy('restore'),
    save: jasmine.createSpy('save'),
    stroke: jasmine.createSpy('stroke'),
    strokeStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

function createOptions(linkColor: string | null = null): FlowOptions {
  return {
    alpha: 0.5,
    colorFrom: 'red',
    colorMode: 'gradient',
    colorTo: 'green',
    flowLabels: {
      borderRadius: 0,
      color: 'black',
      display: false,
      padding: 4,
      position: 'center',
    },
    hoverColorFrom: 'red',
    hoverColorTo: 'green',
    linkColor,
    orientation: 'horizontal',
  }
}

describe('Flow', () => {
  it('uses linkColor independently from its node colors', () => {
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

    expect(context.fillText).toHaveBeenCalledOnceWith('5', 50, 10)
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
    expect(flow.inRange(24, 70, false)).toBeTrue()
    expect(flow.inRange(35, 70, false)).toBeFalse()
    expect(flow.getCenterPoint(false)).toEqual({ x: 24, y: 70 })
  })
})
