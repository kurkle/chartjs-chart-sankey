import {
  ChartMeta,
  DatasetController,
  FromToElement,
  SankeyControllerDatasetOptions,
  SankeyNode,
  SankeyParsedData,
} from 'chart.js'
import { toFont, valueOrDefault, resolve } from 'chart.js/helpers'

import { AnyObject } from '../types/index.esm'

import { buildNodesFromData, getParsedData } from './lib/core'
import { toTextLines, validateSizeValue } from './lib/helpers'
import { layout } from './lib/layout'
import Flow from './flow'

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
    dataElementType: 'flow',
    animations: {
      numbers: {
        type: 'number',
        properties: ['x', 'y', 'x2', 'y2', 'height'],
      },
      progress: {
        easing: 'linear',
        duration: (ctx) => (ctx.type === 'data' ? (ctx.parsed._custom.x - ctx.parsed.x) * 200 : undefined),
        delay: (ctx) => (ctx.type === 'data' ? ctx.parsed.x * 500 + ctx.dataIndex * 20 : undefined),
      },
      colors: {
        type: 'color',
        properties: ['colorFrom', 'colorTo'],
      },
    },
    color: 'black',
    borderColor: 'black',
    borderWidth: 1,
    modeX: 'edge',
    nodeWidth: 10,
    nodePadding: 10,
    transitions: {
      hide: {
        animations: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            to: 'transparent',
          },
        },
      },
      show: {
        animations: {
          colors: {
            type: 'color',
            properties: ['colorFrom', 'colorTo'],
            from: 'transparent',
          },
        },
      },
    },
  }

  static readonly overrides = {
    interaction: {
      mode: 'nearest',
      intersect: true,
    },
    datasets: {
      clip: false,
      parsing: { from: 'from', to: 'to', flow: 'flow' },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title() {
            return ''
          },
          label(context) {
            const parsedCustom = context.parsed._custom
            return parsedCustom.from.key + ' -> ' + parsedCustom.to.key + ': ' + parsedCustom.flow
          },
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        display: false,
        min: 0,
        offset: false,
      },
      y: {
        type: 'linear',
        bounds: 'data',
        display: false,
        min: 0,
        reverse: true,
        offset: false,
      },
    },
    layout: {
      padding: {
        top: 3,
        left: 3,
        right: 13,
        bottom: 3,
      },
    },
  }

  options: SankeyControllerDatasetOptions
  private _nodes: Map<string, SankeyNode>
  private _maxX: number
  private _maxY: number

  override parseObjectData(
    meta: ChartMeta<'sankey', Flow>,
    data: AnyObject[],
    start: number,
    count: number
  ): SankeyParsedData[] {
    const sankeyData = getParsedData(data, this.options.parsing)
    const { xScale, yScale } = meta
    const parsed: SankeyParsedData[] = []
    const nodes = (this._nodes = buildNodesFromData(sankeyData, this.options))

    const { maxX, maxY } = layout(nodes, sankeyData, {
      priority: !!this.options.priority,
      height: this.chart.canvas.height,
      nodePadding: this.options.nodePadding,
      modeX: this.options.modeX,
    })

    this._maxX = maxX
    this._maxY = maxY

    if (!xScale || !yScale) return []

    for (let i = 0, ilen = sankeyData.length; i < ilen; ++i) {
      const dataPoint = sankeyData[i]
      const from = nodes.get(dataPoint.from)
      const to = nodes.get(dataPoint.to)
      if (!from || !to) continue

      const fromY: number = (from.y ?? 0) + getAddY(from.to, dataPoint.to, i)
      const toY: number = (to.y ?? 0) + getAddY(to.from, dataPoint.from, i)

      parsed.push({
        x: xScale.parse(from.x, i) as number,
        y: yScale.parse(fromY, i) as number,
        _custom: {
          from,
          to,
          x: xScale.parse(to.x, i) as number,
          y: yScale.parse(toY, i) as number,
          height: yScale.parse(dataPoint.flow, i) as number,
          flow: dataPoint.flow,
        },
      })
    }
    return parsed.slice(start, start + count)
  }

  override getMinMax(scale) {
    return {
      min: 0,
      max: scale === this._cachedMeta.xScale ? this._maxX : this._maxY,
    }
  }

  override update(mode) {
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
          x: xScale.getPixelForValue(parsed.x) + nodeWidth + borderSpace,
          y,
          x2: xScale.getPixelForValue(custom.x) - borderSpace,
          y2: yScale.getPixelForValue(custom.y),
          from: custom.from,
          to: custom.to,
          progress: mode === 'reset' ? 0 : 1,
          height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
          options: this.resolveDataElementOptions(i, mode),
        },
        mode
      )
    }

    this.updateSharedOptions(sharedOptions, mode, firstOpts)
  }

  private _drawLabels() {
    const ctx = this.chart.ctx
    const options = this.options
    const nodes = this._nodes || new Map()
    const size = validateSizeValue(options.size)
    const borderWidth = options.borderWidth ?? 1
    const nodeWidth = options.nodeWidth ?? 10
    const labels = options.labels
    const nodeLabels = options.nodeLabels
    const { xScale, yScale } = this._cachedMeta

    // Check if labels should be displayed
    if (nodeLabels?.display === false) return
    if (!xScale || !yScale) return

    ctx.save()
    const chartArea = this.chart.chartArea
    
    // Set up label configuration with defaults
    const labelPosition = nodeLabels?.position ?? 'default'
    const labelPadding = nodeLabels?.padding ?? 4
    const labelBorderRadius = nodeLabels?.borderRadius ?? 3
    const labelFont = toFont(nodeLabels?.font ?? options.font, this.chart.options.font)
    
    for (const node of nodes.values()) {
      const x = xScale.getPixelForValue(node.x)
      const y = yScale.getPixelForValue(node.y)

      const max = Math[size](node.in || node.out, node.out || node.in)
      const height = Math.abs(yScale.getPixelForValue(node.y + max) - y)
      const label = labels?.[node.key] ?? node.key
      
      let labelColor = options.color ?? 'black'
      let labelBackgroundColor: string | undefined
      
      // Handle color options with support for object mappings
      if (nodeLabels?.color) {
        if (typeof nodeLabels.color === 'string') {
          labelColor = nodeLabels.color
        } else if (typeof nodeLabels.color === 'object' && nodeLabels.color[node.key]) {
          labelColor = nodeLabels.color[node.key]
        } else if (typeof nodeLabels.color === 'function') {
          try {
            labelColor = nodeLabels.color(node)
          } catch (e) {
            labelColor = options.color ?? 'black'
          }
        }
      }
      
      if (nodeLabels?.backgroundColor) {
        if (typeof nodeLabels.backgroundColor === 'string') {
          labelBackgroundColor = nodeLabels.backgroundColor
        } else if (typeof nodeLabels.backgroundColor === 'object' && nodeLabels.backgroundColor[node.key]) {
          labelBackgroundColor = nodeLabels.backgroundColor[node.key]
        } else if (typeof nodeLabels.backgroundColor === 'function') {
          try {
            labelBackgroundColor = nodeLabels.backgroundColor(node)
          } catch (e) {
            labelBackgroundColor = undefined
          }
        }
      }
      
      this._drawLabel(
        label,
        x,
        y,
        height,
        ctx,
        {
          position: labelPosition,
          padding: labelPadding,
          color: labelColor,
          backgroundColor: labelBackgroundColor,
          borderRadius: labelBorderRadius,
          font: labelFont,
          nodeWidth,
          borderWidth,
          chartArea
        }
      )
    }
    ctx.restore()
  }

  private _drawLabel(
    label: string,
    nodeX: number,
    nodeY: number,
    nodeHeight: number,
    ctx: CanvasRenderingContext2D,
    config: {
      position: 'default' | 'top' | 'bottom'
      padding: number
      color: string
      backgroundColor?: string
      borderRadius: number
      font: any
      nodeWidth: number
      borderWidth: number
      chartArea: any
    }
  ) {
    const lines = toTextLines(label)
    const lineCount = lines.length
    const textHeight = config.font.lineHeight
    const totalTextHeight = textHeight * lineCount
    
    ctx.font = config.font.string
    ctx.fillStyle = config.color
    
    // Calculate text dimensions for background
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
    const backgroundWidth = maxLineWidth + config.padding * 2
    const backgroundHeight = totalTextHeight + config.padding * 2
    
    let textX: number
    let textY: number
    let backgroundX: number
    let backgroundY: number
    
    // Position calculation based on label position setting
    switch (config.position) {
      case 'top':
        textX = nodeX + config.nodeWidth / 2
        textY = nodeY - config.padding - textHeight / 2 - 5
        backgroundX = textX - backgroundWidth / 2
        backgroundY = textY - backgroundHeight / 2
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        break
        
      case 'bottom':
        textX = nodeX + config.nodeWidth / 2
        textY = nodeY + nodeHeight + config.padding + textHeight / 2 + 5
        backgroundX = textX - backgroundWidth / 2
        backgroundY = textY - backgroundHeight / 2
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        break
        
      case 'default':
      default:
        const nodeMiddleY = nodeY + nodeHeight / 2
        if (nodeX < config.chartArea.width / 2) {
          ctx.textAlign = 'left'
          textX = nodeX + config.nodeWidth + config.borderWidth + config.padding
          backgroundX = textX - config.padding
        } else {
          ctx.textAlign = 'right'
          textX = nodeX - config.borderWidth - config.padding
          backgroundX = textX - backgroundWidth + config.padding
        }
        textY = nodeMiddleY
        backgroundY = textY - backgroundHeight / 2
        ctx.textBaseline = 'middle'
        break
    }
    
    // Draw background if specified
    if (config.backgroundColor) {
      ctx.save()
      ctx.fillStyle = config.backgroundColor
      if (config.borderRadius > 0) {
        this._drawRoundedRect(ctx, backgroundX, backgroundY, backgroundWidth, backgroundHeight, config.borderRadius)
        ctx.fill()
      } else {
        ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight)
      }
      ctx.restore()
      ctx.fillStyle = config.color
    }
    
    // Draw text
    if (lineCount > 1) {
      const startY = textY - (totalTextHeight / 2) + (textHeight / 2)
      for (let i = 0; i < lineCount; i++) {
        ctx.fillText(lines[i], textX, startY + i * textHeight)
      }
    } else {
      ctx.fillText(label, textX, textY)
    }
  }
  
  private _drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
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
      const x = xScale!.getPixelForValue(node.x)
      const y = yScale!.getPixelForValue(node.y)

      const max = Math[sizeMethod](node.in || node.out, node.out || node.in)
      const height = Math.abs(yScale!.getPixelForValue(node.y + max) - y)
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
      flow.from.color = flow.options.colorFrom
      flow.to.color = flow.options.colorTo
      if (flow.active) {
        active.push(flow)
      }
    }

    // Make sure nodes connected to hovered flows are using hover colors.
    for (const flow of active) {
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
