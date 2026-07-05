import type {
  ChartMeta,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyParsedData,
} from 'chart.js'
import type Flow from './flow.js'
import type { AnyObject } from './types.js'

import { Chart, DatasetController } from 'chart.js'
import { toFont, valueOrDefault } from 'chart.js/helpers'

import { buildNodesFromData, getParsedData } from './lib/core.js'
import { toTextLines, validateSizeValue } from './lib/helpers.js'
import { layout } from './lib/layout.js'

function nodeX(node: SankeyNode): number {
  if (node.x === undefined) {
    throw new Error(`Missing x coordinate for node "${node.key}"`)
  }
  return node.x
}

function nodeY(node: SankeyNode): number {
  if (node.y === undefined) {
    throw new Error(`Missing y coordinate for node "${node.key}"`)
  }
  return node.y
}

function getAddY(arr: FromToElement[], key: string, index: number): number {
  for (const item of arr) {
    if (item.key === key && item.index === index) {
      return item.addY
    }
  }
  return 0
}

export default class SankeyController extends DatasetController {
  static readonly id = 'sankey'

  static readonly defaults = {
    animations: {
      colors: {
        properties: ['colorFrom', 'colorTo'],
        type: 'color',
      },
      numbers: {
        properties: ['x', 'y', 'x2', 'y2', 'height'],
        type: 'number',
      },
      progress: {
        delay: (ctx: any) =>
          ctx.type === 'data' ? ctx.parsed.x * 500 + ctx.dataIndex * 20 : undefined,
        duration: (ctx: any) =>
          ctx.type === 'data' ? (ctx.parsed._custom.x - ctx.parsed.x) * 200 : undefined,
        easing: 'linear',
      },
    },
    borderColor: 'black',
    borderWidth: 1,
    color: 'black',
    dataElementType: 'flow',
    modeX: 'edge',
    nodePadding: 10,
    nodeWidth: 10,
    transitions: {
      hide: {
        animations: {
          colors: {
            properties: ['colorFrom', 'colorTo'],
            to: 'transparent',
            type: 'color',
          },
        },
      },
      show: {
        animations: {
          colors: {
            from: 'transparent',
            properties: ['colorFrom', 'colorTo'],
            type: 'color',
          },
        },
      },
    },
  }

  static readonly overrides = {
    datasets: {
      clip: false,
      parsing: { flow: 'flow', from: 'from', to: 'to' },
    },
    interaction: {
      intersect: true,
      mode: 'nearest',
    },
    layout: {
      padding: {
        bottom: 3,
        left: 3,
        right: 13,
        top: 3,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context: any) {
            const parsedCustom = context.parsed._custom
            return `${parsedCustom.from.key} -> ${parsedCustom.to.key}: ${parsedCustom.flow}`
          },
          title() {
            return ''
          },
        },
      },
    },
    scales: {
      x: {
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
        type: 'linear',
      },
      y: {
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
        reverse: true,
        type: 'linear',
      },
    },
  }

  declare options: SankeyControllerDatasetOptions
  private _nodes = new Map<string, SankeyNode>()
  private _maxX = 0
  private _maxY = 0

  override parseObjectData(
    meta: ChartMeta<'sankey', Flow>,
    data: AnyObject[],
    start: number,
    count: number
  ): SankeyParsedData[] {
    const sankeyData = getParsedData(data, this.options.parsing)
    const { xScale, yScale } = meta
    const parsed: SankeyParsedData[] = []
    const nodes = buildNodesFromData(sankeyData, this.options)
    this._nodes = nodes

    const { maxX, maxY } = layout(nodes, sankeyData, {
      height: this.chart.canvas.height,
      modeX: this.options.modeX,
      nodePadding: this.options.nodePadding ?? 10,
      priority: !!this.options.priority,
    })

    this._maxX = maxX
    this._maxY = maxY

    if (!xScale || !yScale) return []

    for (let i = 0, ilen = sankeyData.length; i < ilen; ++i) {
      const dataPoint = sankeyData[i]
      const from = nodes.get(dataPoint.from)
      const to = nodes.get(dataPoint.to)
      if (!from || !to) continue

      const fromY: number = nodeY(from) + getAddY(from.to, dataPoint.to, i)
      const toY: number = nodeY(to) + getAddY(to.from, dataPoint.from, i)

      parsed.push({
        _custom: {
          flow: dataPoint.flow,
          from,
          height: yScale.parse(dataPoint.flow, i) as number,
          to,
          x: xScale.parse(nodeX(to), i) as number,
          y: yScale.parse(toY, i) as number,
        },
        x: xScale.parse(nodeX(from), i) as number,
        y: yScale.parse(fromY, i) as number,
      })
    }
    return parsed.slice(start, start + count)
  }

  override getMinMax(scale: any) {
    return {
      max: scale === this._cachedMeta.xScale ? this._maxX : this._maxY,
      min: 0,
    }
  }

  override update(mode: any) {
    const { data } = this._cachedMeta as ChartMeta<'sankey', Flow>

    this.updateElements(data, 0, data.length, mode)
  }

  override updateElements(
    elems: Flow[],
    start: number,
    count: number,
    mode: 'default' | 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'active'
  ) {
    const { xScale, yScale } = this._cachedMeta
    if (!xScale || !yScale) return

    const firstOpts = this.resolveDataElementOptions(start, mode)
    const sharedOptions = this.getSharedOptions(firstOpts)
    const { borderWidth, nodeWidth = 10 } = this.options
    const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0

    for (let i = start; i < start + count; i++) {
      const parsed = this.getParsed(i) as SankeyParsedData
      const custom = parsed._custom
      const y = yScale.getPixelForValue(parsed.y)
      this.updateElement(
        elems[i],
        i,
        {
          from: custom.from,
          height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
          options: this.resolveDataElementOptions(i, mode),
          progress: mode === 'reset' ? 0 : 1,
          to: custom.to,
          x: xScale.getPixelForValue(parsed.x) + nodeWidth + borderSpace,
          x2: xScale.getPixelForValue(custom.x) - borderSpace,
          y,
          y2: yScale.getPixelForValue(custom.y),
        },
        mode
      )
    }

    this.updateSharedOptions(sharedOptions || {}, mode, firstOpts)
  }

  private _drawLabels() {
    const ctx = this.chart.ctx
    const options = this.options
    const nodes = this._nodes || new Map()
    const size = validateSizeValue(options.size)
    const borderWidth = options.borderWidth ?? 1
    const nodeWidth = options.nodeWidth ?? 10
    const labels = options.labels
    const { xScale, yScale } = this._cachedMeta

    if (!xScale || !yScale) return

    ctx.save()
    const chartArea = this.chart.chartArea
    for (const node of nodes.values()) {
      const x = xScale.getPixelForValue(nodeX(node))
      const y = yScale.getPixelForValue(nodeY(node))

      const max = Math[size](node.in || node.out, node.out || node.in)
      const height = Math.abs(yScale.getPixelForValue(nodeY(node) + max) - y)
      const label = labels?.[node.key] ?? node.key
      let textX = x
      ctx.fillStyle = options.color ?? 'black'
      ctx.textBaseline = 'middle'
      if (x < chartArea.width / 2) {
        ctx.textAlign = 'left'
        textX += nodeWidth + borderWidth + 4
      } else {
        ctx.textAlign = 'right'
        textX -= borderWidth + 4
      }
      this._drawLabel(label, y, height, ctx, textX)
    }
    ctx.restore()
  }

  private _drawLabel(
    label: string,
    y: number,
    height: number,
    ctx: CanvasRenderingContext2D,
    textX: number
  ) {
    const font = toFont(this.options.font ?? this.chart.options.font ?? Chart.defaults.font)
    const lines = toTextLines(label)
    const lineCount = lines.length
    const middle = y + height / 2
    const textHeight = font.lineHeight
    const padding = valueOrDefault(this.options.padding, textHeight / 2)

    ctx.font = font.string

    if (lineCount > 1) {
      const top = middle - (textHeight * lineCount) / 2 + padding
      for (let i = 0; i < lineCount; i++) {
        ctx.fillText(lines[i], textX, top + i * textHeight)
      }
    } else {
      ctx.fillText(label, textX, middle)
    }
  }

  private _drawNodes() {
    const ctx = this.chart.ctx
    const nodes = this._nodes || new Map()
    const { borderColor, borderWidth = 0, nodeWidth = 10, size } = this.options
    const sizeMethod = validateSizeValue(size)
    const { xScale, yScale } = this._cachedMeta

    ctx.save()
    if (borderColor && borderWidth) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
    }

    for (const node of nodes.values()) {
      ctx.fillStyle = node.color ?? 'black'
      if (!xScale || !yScale) return

      const x = xScale.getPixelForValue(nodeX(node))
      const y = yScale.getPixelForValue(nodeY(node))

      const max = Math[sizeMethod](node.in || node.out, node.out || node.in)
      const height = Math.abs(yScale.getPixelForValue(nodeY(node) + max) - y)
      if (borderWidth) {
        ctx.strokeRect(x, y, nodeWidth, height)
      }
      ctx.fillRect(x, y, nodeWidth, height)
    }
    ctx.restore()
  }

  /**
   * That's where the drawing process happens
   */
  override draw() {
    const ctx = this.chart.ctx
    const data = (this.getMeta().data as Flow[]) ?? []

    // Set node colors
    const active: Flow[] = []
    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      const flow = data[i] /* Flow at index i */
      if (!flow.from || !flow.to) {
        continue
      }
      flow.from.color = flow.options.colorFrom
      flow.to.color = flow.options.colorTo
      if (flow.active) {
        active.push(flow)
      }
    }

    // Make sure nodes connected to hovered flows are using hover colors.
    for (const flow of active) {
      if (!flow.from || !flow.to) {
        continue
      }
      flow.from.color = flow.options.colorFrom
      flow.to.color = flow.options.colorTo
    }

    this._drawNodes()

    for (let i = 0, ilen = data.length; i < ilen; ++i) {
      data[i].draw(ctx)
    }

    this._drawLabels()
  }
}
