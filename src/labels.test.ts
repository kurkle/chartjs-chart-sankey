import type { CanvasFontSpec } from 'chart.js'
import type { DrawLabelOptions } from './labels.js'
import type { SankeyNode } from './types.js'

import { drawLabel, resolveNodeLabelOption } from './labels.js'

const node = { key: 'A' } as SankeyNode

function createContext() {
  return {
    beginPath: jasmine.createSpy('beginPath'),
    closePath: jasmine.createSpy('closePath'),
    fill: jasmine.createSpy('fill'),
    fillRect: jasmine.createSpy('fillRect'),
    fillStyle: '',
    fillText: jasmine.createSpy('fillText'),
    font: '',
    lineTo: jasmine.createSpy('lineTo'),
    measureText: jasmine.createSpy('measureText').and.returnValue({ width: 20 } as TextMetrics),
    moveTo: jasmine.createSpy('moveTo'),
    quadraticCurveTo: jasmine.createSpy('quadraticCurveTo'),
    restore: jasmine.createSpy('restore'),
    save: jasmine.createSpy('save'),
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

function createOptions(overrides: Partial<DrawLabelOptions> = {}): DrawLabelOptions {
  return {
    autoPosition: 'right',
    borderRadius: 0,
    borderWidth: 1,
    color: 'black',
    font: {
      family: 'Arial',
      lineHeight: 10,
      size: 10,
      string: '10px Arial',
      style: 'normal',
      weight: 'normal',
    } as CanvasFontSpec,
    height: 20,
    lineOffset: 5,
    padding: 4,
    position: 'auto',
    width: 10,
    x: 20,
    y: 20,
    ...overrides,
  }
}

describe('node labels', () => {
  it('resolves static, mapped, and callback options', () => {
    const mapped = Object.assign(Object.create(null), { A: 'right' })

    expect(resolveNodeLabelOption('left', node)).toBe('left')
    expect(resolveNodeLabelOption(mapped, node)).toBe('right')
    expect(resolveNodeLabelOption((item) => (item.key === 'A' ? 'top' : 'bottom'), node)).toBe(
      'top'
    )
  })

  it('uses the right side for auto-positioned nodes in the left half', () => {
    const ctx = createContext()

    drawLabel(ctx, 'A', createOptions())

    expect(ctx.textAlign).toBe('left')
    expect(ctx.fillText).toHaveBeenCalledOnceWith('A', 35, 30)
  })

  it('draws a padded background behind a centered label', () => {
    const ctx = createContext()

    drawLabel(ctx, 'A', createOptions({ backgroundColor: 'red', position: 'center' }))

    expect(ctx.fillRect).toHaveBeenCalledOnceWith(11, 21, 28, 18)
    expect(ctx.fillText).toHaveBeenCalledOnceWith('A', 25, 30)
  })
})
