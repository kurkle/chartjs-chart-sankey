import type { NodeOptions, NodeProps, SankeyNode } from './types.js'

import { Element } from 'chart.js'

/**
 * The bar of a node. The controller keeps one per node in `meta.nodes`, tweens
 * them with the flows and draws them itself, before the flows: the element is
 * not drawn on its own. It is filled with `node.color`, which the controller's
 * draw writes from the flows of the node on every frame. The package registers
 * it, but the controller never looks it up, so a chart works without it.
 */
export default class NodeElement extends Element<NodeProps, NodeOptions> {
  static readonly id = 'node'

  width = 0
  height = 0
  node?: SankeyNode

  /** Whether a point is on the bar, edges included, at the current or the final place. */
  inRange(mouseX: number, mouseY: number, useFinalPosition?: boolean) {
    const { height, width, x, y } = this.getProps(['x', 'y', 'width', 'height'], useFinalPosition)
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height
  }

  /** The middle of the bar, at the current or the final place. */
  getCenterPoint(useFinalPosition?: boolean) {
    const { height, width, x, y } = this.getProps(['x', 'y', 'width', 'height'], useFinalPosition)
    return { x: x + width / 2, y: y + height / 2 }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { borderColor, borderWidth } = this.options
    const { height, width, x, y } = this

    ctx.save()
    if (borderColor && borderWidth) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
    }
    ctx.fillStyle = this.node?.color ?? 'black'
    if (borderWidth) {
      ctx.strokeRect(x, y, width, height)
    }
    ctx.fillRect(x, y, width, height)
    ctx.restore()
  }
}
