import type { CanvasFontSpec, Color } from 'chart.js'
import type { SankeyLabelPosition, SankeyNode, SankeyNodeOption } from './types.js'

import { toTextLines } from './lib/helpers.js'

function isPatternOrGradient(value: object) {
  const type = Object.prototype.toString.call(value)
  return type === '[object CanvasPattern]' || type === '[object CanvasGradient]'
}

type ResolvedLabelPosition = Exclude<SankeyLabelPosition, 'auto'>

export interface LabelBounds {
  bottom: number
  left: number
  right: number
  top: number
}

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

/** Space left between two labels of a column, in pixels. */
const LABEL_GAP = 1

export interface MeasuredLabel {
  align: CanvasTextAlign
  /** the visible box: text plus padding when there is a background, the text alone otherwise */
  box: { height: number; width: number; x: number; y: number }
  options: DrawLabelOptions
  /** how the label is moved after layout, see {@link resolveLabelOverlaps} */
  shift: { x: number; y: number }
  lines: string[]
  position: ResolvedLabelPosition
  textX: number
  textYs: number[]
}

/** The single place where a label's box is computed; the box measured is the box drawn. */
export function measureLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  options: DrawLabelOptions
): MeasuredLabel | undefined {
  const lines = toTextLines(label)
  if (!lines.length) return undefined

  const { backgroundColor, font, lineOffset, padding } = options
  const position = resolvePosition(options.position, options.autoPosition)
  const textHeight = Number(font.lineHeight)
  ctx.font = font.string
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
  const totalTextHeight = textHeight * lines.length
  const text = getTextPosition(position, options, totalTextHeight)

  const backgroundWidth = textWidth + padding * 2
  const backgroundHeight = totalTextHeight + padding * 2
  const backgroundX = getBackgroundX(text.align, text.x, textWidth, backgroundWidth, padding)
  const firstLineY = lines.length === 1 ? text.y : text.y - totalTextHeight / 2 + lineOffset
  const backgroundY = firstLineY + ((lines.length - 1) * textHeight) / 2 - backgroundHeight / 2
  const inset = backgroundColor === undefined ? padding : 0

  return {
    align: text.align,
    box: {
      height: backgroundHeight - inset * 2,
      width: backgroundWidth - inset * 2,
      x: backgroundX + inset,
      y: backgroundY + inset,
    },
    lines,
    options,
    position,
    shift: { x: 0, y: 0 },
    textX: text.x,
    textYs: lines.map((_, i) => firstLineY + i * textHeight),
  }
}

export function paintLabel(ctx: CanvasRenderingContext2D, measured: MeasuredLabel) {
  const { align, lines, options, shift, textX, textYs } = measured
  const { backgroundColor, borderRadius, color } = options

  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.font = options.font.string

  if (backgroundColor !== undefined) {
    const { height, width, x, y } = measured.box
    drawBackground(ctx, backgroundColor, x + shift.x, y + shift.y, width, height, borderRadius)
  }

  ctx.fillStyle = color
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX + shift.x, textYs[i] + shift.y)
  }
}

export function drawLabel(ctx: CanvasRenderingContext2D, label: string, options: DrawLabelOptions) {
  const measured = measureLabel(ctx, label, options)
  if (measured) paintLabel(ctx, measured)
}

/**
 * How far a label may be moved to get out of its neighbours' way, as a share
 * of its own size along the column. One half keeps the node's centre line
 * within the span of its label, so a label always visibly sits at its node.
 * Keeping the label inside the chart area is not limited by it.
 */
const LABEL_MAX_SHIFT = 0.5

/** Relaxation passes at most; a column of labels settles long before this. */
const MAX_PASSES = 200

/**
 * Places spans, given in order, on one axis so that they stay between `min`
 * and `max` and do not cover each other more than they have to. A span that
 * fits does not move. A span may leave its wished start only by
 * {@link LABEL_MAX_SHIFT} of its size, except where the bounds demand more; where that
 * is not enough to separate neighbours they keep overlapping, and each moves
 * half of the way. Returns the new starts.
 */
export function resolveSpans(
  spans: { size: number; start: number }[],
  min: number,
  max: number
): number[] {
  const starts = spans.map(({ size, start }) => Math.max(min, Math.min(start, max - size)))
  const low = spans.map(({ size }, i) => Math.max(min, starts[i] - size * LABEL_MAX_SHIFT))
  const high = spans.map(({ size }, i) =>
    Math.max(low[i], Math.min(max - size, starts[i] + size * LABEL_MAX_SHIFT))
  )

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false
    for (let i = 0; i + 1 < spans.length; i++) {
      const overlap = starts[i] + spans[i].size + LABEL_GAP - starts[i + 1]
      if (overlap <= 0.001) continue
      // the earlier span moves back, the later one forward; what one cannot move the other does
      const back = Math.min(overlap / 2, starts[i] - low[i])
      const forward = Math.min(overlap - back, high[i + 1] - starts[i + 1])
      const extraBack = Math.min(overlap - forward - back, starts[i] - low[i] - back)
      starts[i] -= back + extraBack
      starts[i + 1] += forward
      moved = moved || back + extraBack + forward > 0
    }
    if (!moved) break
  }
  return starts
}

/**
 * Moves the labels of one column and side along the cross axis so that they
 * stay inside the bounds and do not cover each other.
 */
export function resolveLabelOverlaps(labels: MeasuredLabel[], bounds: LabelBounds) {
  if (!labels.length) return
  const vertical = labels[0].position === 'left' || labels[0].position === 'right'
  const key = vertical ? 'y' : 'x'
  const sizeKey = vertical ? 'height' : 'width'
  const order = labels.slice().sort((a, b) => a.box[key] - b.box[key])
  const starts = resolveSpans(
    order.map((label) => ({ size: label.box[sizeKey], start: label.box[key] })),
    vertical ? bounds.top : bounds.left,
    vertical ? bounds.bottom : bounds.right
  )
  order.forEach((label, i) => {
    label.shift[key] = starts[i] - label.box[key]
  })
}

/**
 * Keeps the labels of every column and side apart; `center` labels are drawn on
 * their node and are left alone.
 */
export function resolveLabelColumns(
  entries: { column: number; label: MeasuredLabel }[],
  bounds: LabelBounds
) {
  const groups = new Map<string, MeasuredLabel[]>()
  for (const { column, label } of entries) {
    if (label.position === 'center') continue
    const key = `${label.position}:${column}`
    groups.set(key, [...(groups.get(key) ?? []), label])
  }
  for (const group of groups.values()) {
    resolveLabelOverlaps(group, bounds)
  }
}
