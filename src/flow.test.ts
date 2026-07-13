import type { FlowOptions } from './types.js'

import Flow from './flow.js'

function createContext() {
  return {
    beginPath: jasmine.createSpy('beginPath'),
    bezierCurveTo: jasmine.createSpy('bezierCurveTo'),
    closePath: jasmine.createSpy('closePath'),
    fill: jasmine.createSpy('fill'),
    fillStyle: '',
    lineTo: jasmine.createSpy('lineTo'),
    lineWidth: 0,
    moveTo: jasmine.createSpy('moveTo'),
    restore: jasmine.createSpy('restore'),
    save: jasmine.createSpy('save'),
    stroke: jasmine.createSpy('stroke'),
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function createOptions(linkColor: string | null = null): FlowOptions {
  return {
    alpha: 0.5,
    colorFrom: 'red',
    colorMode: 'gradient',
    colorTo: 'green',
    hoverColorFrom: 'red',
    hoverColorTo: 'green',
    linkColor,
  }
}

describe('Flow', () => {
  it('uses linkColor independently from its node colors', () => {
    const context = createContext()
    const flow = new Flow({
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
})
