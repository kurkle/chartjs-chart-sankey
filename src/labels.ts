import type { CanvasFontSpec, Color } from 'chart.js'
import type {
  SankeyLabelPosition,
  SankeyNode,
  SankeyNodeOption,
  SankeyOrientation,
} from './types.js'

import { _longestText, renderText } from 'chart.js/helpers'

import { toTextLines } from './lib/helpers.js'

// Chart.js has this helper too, but it calls `toString` on the value, which an
// option resolved by Chart.js (a proxy) does not have.
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
  /** the canvas, in CSS pixels; when set, the label is kept inside it */
  canvas?: { height: number; width: number }
  color: Color
  font: CanvasFontSpec
  height: number
  lineOffset: number
  orientation?: SankeyOrientation
  padding: number
  position: SankeyLabelPosition
  width: number
  x: number
  y: number
}

export function resolveNodeOption<T>(
  option: SankeyNodeOption<T> | undefined,
  node: SankeyNode
): T | undefined {
  if (typeof option === 'function') {
    return (option as (node: SankeyNode) => T | undefined)(node)
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

/** Share of its own size along the column that a label may move to get out of a neighbour's way. */
const MAX_SHIFT = 0.5

export interface MeasuredLabel {
  position: ResolvedLabelPosition
  /** where the labels of the column may go, and the label's visible extent there */
  max: number
  size: number
  start: number
  /** how far the label is moved when drawn, along the column */
  shift: number
  paint(): void
}

/** How far a span has to move to fit between `min` and `max`; one that is too large stays at `min`. */
function clampShift(start: number, size: number, min: number, max: number) {
  return size >= max - min || start < min ? min - start : Math.min(0, max - start - size)
}

/** The ink of a line: how far its glyphs reach above and below its centre (all lines are taken alike). */
function measureInk(ctx: CanvasRenderingContext2D, lines: string[], lineHeight: number) {
  ctx.save()
  ctx.textBaseline = 'middle'
  const { actualBoundingBoxAscent: up = lineHeight / 2, actualBoundingBoxDescent: down = up } =
    ctx.measureText(lines[0])
  ctx.restore()
  return { size: (lines.length - 1) * lineHeight + up + down, up }
}

/**
 * The visible extent of a label, a background box or the glyphs without one, along the
 * axis the labels of a column are stacked on (y in a horizontal chart, x in a vertical
 * one), and how far to move it along the other axis to keep it inside the canvas.
 */
function getExtents(
  { backgroundColor, canvas, orientation, padding }: DrawLabelOptions,
  box: { height: number; width: number; x: number; y: number },
  text: { ink: { size: number; up: number }; textWidth: number; top: number }
) {
  const boxed = backgroundColor !== undefined
  const x = boxed
    ? { size: box.width, start: box.x }
    : { size: text.textWidth, start: box.x + padding }
  const y = boxed
    ? { size: box.height, start: box.y }
    : { size: text.ink.size, start: text.top - text.ink.up }
  const stackedX = orientation === 'vertical'
  const [stacked, other] = stackedX ? [x, y] : [y, x]
  const room = stackedX ? canvas?.height : canvas?.width
  return {
    along: canvas ? clampShift(other.start, other.size, 0, room as number) : 0,
    stacked,
    stackedX,
  }
}

function moveBy(ctx: CanvasRenderingContext2D, dx: number, dy: number) {
  if (dx || dy) ctx.translate(dx, dy)
}

/** Computes a label's box once; the box that is placed is the box that is drawn. */
export function measureLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  options: DrawLabelOptions
): MeasuredLabel | undefined {
  const lines = toTextLines(label)
  if (!lines.length) return undefined

  const { backgroundColor, borderRadius, canvas, color, font, lineOffset, padding } = options
  const position = resolvePosition(options.position, options.autoPosition)
  const textHeight = Number(font.lineHeight)
  const textWidth = _longestText(ctx, font.string, lines)
  const totalTextHeight = textHeight * lines.length
  const text = getTextPosition(position, options, totalTextHeight)

  const backgroundWidth = textWidth + padding * 2
  const backgroundHeight = totalTextHeight + padding * 2
  const backgroundX = getBackgroundX(text.align, text.x, textWidth, backgroundWidth, padding)
  const firstLineY = lines.length === 1 ? text.y : text.y - totalTextHeight / 2 + lineOffset
  const textCenterY = firstLineY + ((lines.length - 1) * textHeight) / 2
  const backgroundY = textCenterY - backgroundHeight / 2

  const { along, stacked, stackedX } = getExtents(
    options,
    { height: backgroundHeight, width: backgroundWidth, x: backgroundX, y: backgroundY },
    { ink: measureInk(ctx, lines, textHeight), textWidth, top: firstLineY }
  )

  const measured: MeasuredLabel = {
    max: (stackedX ? canvas?.width : canvas?.height) ?? Infinity,
    paint() {
      ctx.save()
      moveBy(ctx, stackedX ? measured.shift : along, stackedX ? along : measured.shift)
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
      renderText(ctx, lines, text.x, firstLineY, font, {
        color,
        textAlign: text.align,
        textBaseline: 'middle',
      })
      ctx.restore()
    },
    position,
    shift: 0,
    size: stacked.size,
    start: stacked.start,
  }
  return measured
}

export function drawLabel(ctx: CanvasRenderingContext2D, label: string, options: DrawLabelOptions) {
  measureLabel(ctx, label, options)?.paint()
}

/**
 * Places the labels of one column and side, in order, between `min` and `max`
 * without covering each other more than they have to. A label that fits stays
 * where it is. It may leave its start by `MAX_SHIFT` of its size to make room,
 * except where the bounds demand more; neighbours that still collide share the
 * overlap, and one pixel is left between them where there is room.
 */
function placeGroup(labels: MeasuredLabel[], min: number, max: number) {
  labels.sort((a, b) => a.start - b.start)
  const spans = labels.map(({ size, start }) => {
    const at = Math.max(min, Math.min(start, max - size))
    const low = Math.max(min, at - size * MAX_SHIFT)
    return { at, high: Math.max(low, Math.min(max - size, at + size * MAX_SHIFT)), low, size }
  })
  for (let pass = 0; pass < 100; pass++) {
    for (let i = 1; i < spans.length; i++) {
      const [a, b] = [spans[i - 1], spans[i]]
      const overlap = a.at + a.size + 1 - b.at
      const forward = Math.min(overlap - Math.min(overlap / 2, a.at - a.low), b.high - b.at)
      if (overlap > 0) {
        a.at -= Math.min(overlap - forward, a.at - a.low)
        b.at += forward
      }
    }
  }
  labels.forEach((label, i) => {
    label.shift = spans[i].at - label.start
  })
}

/**
 * Draws the labels of a chart. The labels on one side of one column keep their
 * order and are nudged apart, and every label is kept inside the canvas.
 */
export function paintLabels(entries: { column: number; label: MeasuredLabel }[]) {
  const groups = new Map<string, MeasuredLabel[]>()
  for (const { column, label } of entries) {
    const key = `${label.position}:${column}`
    groups.set(key, [...(groups.get(key) ?? []), label])
  }
  for (const group of groups.values()) {
    placeGroup(group, 0, group[0].max)
  }
  for (const { label } of entries) {
    label.paint()
  }
}
