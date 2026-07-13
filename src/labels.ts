import type { CanvasFontSpec, Color } from 'chart.js'
import type { SankeyLabelPosition, SankeyNode, SankeyNodeLabelOption } from './types.js'

import { toTextLines } from './lib/helpers.js'

type ResolvableNodeLabelValue = boolean | Color | SankeyLabelPosition

function isPatternOrGradient(value: object) {
  const type = Object.prototype.toString.call(value)
  return type === '[object CanvasPattern]' || type === '[object CanvasGradient]'
}

type ResolvedLabelPosition = Exclude<SankeyLabelPosition, 'auto'>

export interface DrawLabelOptions {
  autoPosition: ResolvedLabelPosition
  backgroundColor?: Color
  borderRadius: number
  borderWidth: number
  color: Color
  font: CanvasFontSpec
  height: number
  lineOffset: number
  padding: number
  position: SankeyLabelPosition
  width: number
  x: number
  y: number
}

export function resolveNodeLabelOption<T extends ResolvableNodeLabelValue>(
  option: SankeyNodeLabelOption<T> | undefined,
  node: SankeyNode
): T | undefined {
  if (typeof option === 'function') {
    return option(node)
  }
  if (option && typeof option === 'object' && !isPatternOrGradient(option)) {
    return (option as Record<string, T>)[node.key]
  }
  return option as T | undefined
}

function addRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function resolvePosition(
  position: SankeyLabelPosition,
  autoPosition: ResolvedLabelPosition
): ResolvedLabelPosition {
  return position === 'auto' ? autoPosition : position
}

function getTextPosition(
  position: ResolvedLabelPosition,
  options: DrawLabelOptions,
  totalTextHeight: number
) {
  const { borderWidth, height, padding, width, x, y } = options
  const text = {
    align: 'center' as CanvasTextAlign,
    x: x + width / 2,
    y: y + height / 2,
  }
  if (position === 'left') {
    text.align = 'right'
    text.x = x - borderWidth - padding
  } else if (position === 'right') {
    text.align = 'left'
    text.x = x + width + borderWidth + padding
  } else if (position === 'top') {
    text.y = y - padding - totalTextHeight / 2
  } else if (position === 'bottom') {
    text.y = y + height + padding + totalTextHeight / 2
  }
  return text
}

function getBackgroundX(
  textAlign: CanvasTextAlign,
  textX: number,
  textWidth: number,
  backgroundWidth: number,
  padding: number
) {
  if (textAlign === 'left') return textX - padding
  if (textAlign === 'right') return textX - textWidth - padding
  return textX - backgroundWidth / 2
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  color: Color,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number
) {
  ctx.save()
  ctx.fillStyle = color
  if (borderRadius > 0) {
    addRoundedRectPath(ctx, x, y, width, height, borderRadius)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, width, height)
  }
  ctx.restore()
}

export function drawLabel(ctx: CanvasRenderingContext2D, label: string, options: DrawLabelOptions) {
  const lines = toTextLines(label)
  if (!lines.length) return

  const { backgroundColor, borderRadius, color, font, lineOffset, padding } = options
  const position = resolvePosition(options.position, options.autoPosition)
  const textHeight = Number(font.lineHeight)
  ctx.font = font.string
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
  const totalTextHeight = textHeight * lines.length
  const text = getTextPosition(position, options, totalTextHeight)

  ctx.textAlign = text.align
  ctx.textBaseline = 'middle'

  const backgroundWidth = textWidth + padding * 2
  const backgroundHeight = totalTextHeight + padding * 2
  const backgroundX = getBackgroundX(text.align, text.x, textWidth, backgroundWidth, padding)
  const firstLineY = lines.length === 1 ? text.y : text.y - totalTextHeight / 2 + lineOffset
  const textCenterY = firstLineY + ((lines.length - 1) * textHeight) / 2
  const backgroundY = textCenterY - backgroundHeight / 2

  if (backgroundColor !== undefined) {
    drawBackground(
      ctx,
      backgroundColor,
      backgroundX,
      backgroundY,
      backgroundWidth,
      backgroundHeight,
      borderRadius
    )
  }

  ctx.fillStyle = color
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], text.x, firstLineY + i * textHeight)
  }
}
