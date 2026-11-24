import type { SankeyNode } from './types.js'

import * as esm from './index.esm.js'
import NodeElement from './node.js'

function createContext() {
  return {
    fillRect: vi.fn(),
    fillStyle: '',
    lineWidth: 0,
    restore: vi.fn(),
    save: vi.fn(),
    strokeRect: vi.fn(),
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function createNode(options = { borderColor: 'black', borderWidth: 1 }) {
  return Object.assign(new NodeElement(), {
    height: 40,
    node: { color: 'red', key: 'A' } as SankeyNode,
    options,
    width: 10,
    x: 100,
    y: 50,
  })
}

/**
 * A node that is moving, as running tweens leave it: from the bar 100..110 x
 * 50..90 to the bar 300..320 x 500..560. Every prop has a final value of its
 * own, so a hit test that read one of them from the current place misses.
 */
function createMovingNode() {
  const running = (to: number) => ({ _to: to, active: () => true })
  return Object.assign(createNode(), {
    $animations: { height: running(60), width: running(20), x: running(300), y: running(500) },
  })
}

describe('NodeElement', () => {
  it('is exported by the ESM entry', () => {
    expect((esm as Record<string, unknown>).NodeElement).toBe(NodeElement)
  })

  describe('inRange', () => {
    it('holds a point on the bar, its edges included, and no point beside it', () => {
      const node = createNode()
      expect(node.inRange(105, 70, false)).toBe(true)
      expect(node.inRange(100, 50, false)).toBe(true)
      expect(node.inRange(110, 90, false)).toBe(true)
      expect(node.inRange(99, 70, false)).toBe(false)
      expect(node.inRange(111, 70, false)).toBe(false)
      expect(node.inRange(105, 49, false)).toBe(false)
      expect(node.inRange(105, 91, false)).toBe(false)
    })

    it('tests the current place or the final one, as asked', () => {
      const node = createMovingNode()
      // The current bar, its corners included.
      for (const [x, y] of [
        [100, 50],
        [110, 90],
        [105, 70],
      ]) {
        expect(node.inRange(x, y, false)).toBe(true)
        expect(node.inRange(x, y, true)).toBe(false)
      }
      // The final bar, its corners and the far ends of its width and height.
      for (const [x, y] of [
        [300, 500],
        [320, 560],
        [315, 530],
        [310, 555],
      ]) {
        expect(node.inRange(x, y, true)).toBe(true)
        expect(node.inRange(x, y, false)).toBe(false)
      }
      expect(node.inRange(321, 530, true)).toBe(false)
      expect(node.inRange(310, 561, true)).toBe(false)
      expect(node.inRange(299, 530, true)).toBe(false)
      expect(node.inRange(310, 499, true)).toBe(false)
    })

    it('holds the edge of a bar with no width or no height', () => {
      const flat = createNode()
      flat.width = 0
      expect(flat.inRange(100, 70, false)).toBe(true)
      expect(flat.inRange(101, 70, false)).toBe(false)
      const thin = createNode()
      thin.height = 0
      expect(thin.inRange(105, 50, false)).toBe(true)
      expect(thin.inRange(105, 51, false)).toBe(false)
    })
  })

  describe('getCenterPoint', () => {
    it('is the middle of the bar', () => {
      expect(createNode().getCenterPoint(false)).toEqual({ x: 105, y: 70 })
    })

    it('is the middle of the current place or of the final one, as asked', () => {
      const node = createMovingNode()
      expect(node.getCenterPoint(false)).toEqual({ x: 105, y: 70 })
      expect(node.getCenterPoint(true)).toEqual({ x: 310, y: 530 })
    })
  })

  describe('draw', () => {
    it('fills the bar with the colour of the node and strokes its border', () => {
      const ctx = createContext()
      createNode().draw(ctx)
      expect(ctx.fillStyle).toBe('red')
      expect(ctx.strokeStyle).toBe('black')
      expect(ctx.lineWidth).toBe(1)
      expect(ctx.strokeRect).toHaveBeenCalledWith(100, 50, 10, 40)
      expect(ctx.fillRect).toHaveBeenCalledWith(100, 50, 10, 40)
      expect(ctx.save).toHaveBeenCalledTimes(1)
      expect(ctx.restore).toHaveBeenCalledTimes(1)
    })

    it('draws no border when its width is 0', () => {
      const ctx = createContext()
      createNode({ borderColor: 'black', borderWidth: 0 }).draw(ctx)
      expect(ctx.strokeRect).not.toHaveBeenCalled()
      expect(ctx.strokeStyle).toBe('')
      expect(ctx.fillRect).toHaveBeenCalledWith(100, 50, 10, 40)
    })

    it('fills with black before the node has a colour', () => {
      const ctx = createContext()
      const node = createNode()
      node.node = { key: 'A' } as SankeyNode
      node.draw(ctx)
      expect(ctx.fillStyle).toBe('black')
    })
  })
})
