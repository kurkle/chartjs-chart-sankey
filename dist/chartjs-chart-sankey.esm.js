/*!
 * chartjs-chart-sankey v0.14.0
 * https://github.com/kurkle/chartjs-chart-sankey#readme
 * (c) 2025 Jukka Kurkela
 * Released under the MIT license
 */
import { DatasetController, Element } from 'chart.js';
import { toFont, valueOrDefault, getHoverColor, color } from 'chart.js/helpers';

const defined = (x)=>x !== undefined;
function toTextLines(raw) {
    if (!raw) return [];
    const lines = [];
    const inputs = Array.isArray(raw) ? raw : [
        raw
    ];
    while(inputs.length){
        const input = inputs.pop();
        if (typeof input === 'string') {
            lines.unshift(...input.split('\n'));
        } else if (Array.isArray(input)) {
            inputs.push(...input);
        } else if (input) {
            lines.unshift(`${input}`);
        }
    }
    return lines;
}
function validateSizeValue(size) {
    if (!size || [
        'min',
        'max'
    ].indexOf(size) === -1) {
        return 'max';
    }
    return size;
}

const flowSort = (a, b)=>{
    if (b.flow === a.flow) return a.index - b.index;
    return b.flow - a.flow;
};
const setSizes = (nodes, size)=>{
    const sizeMethod = validateSizeValue(size);
    for (const node of nodes.values()){
        node.from.sort(flowSort);
        node.to.sort(flowSort);
        node.size = Math[sizeMethod](node.in || node.out, node.out || node.in);
    }
};
const setPriorities = (nodes, priority)=>{
    if (!priority) return;
    for (const node of nodes.values()){
        if (node.key in priority) {
            node.priority = priority[node.key];
        }
    }
};
const setColumns = (nodes, column)=>{
    if (!column) return;
    for (const node of nodes.values()){
        if (node.key in column) {
            node.column = true;
            node.x = column[node.key];
        }
    }
};
const getParsedData = (data, parsing)=>{
    const { from: fromKey = 'from', to: toKey = 'to', flow: flowKey = 'flow' } = parsing;
    return data.map(({ [fromKey]: from, [toKey]: to, [flowKey]: flow })=>({
            from,
            to,
            flow
        }));
};
function buildNodesFromData(data, { size, priority, column }) {
    const nodes = new Map();
    for(let i = 0; i < data.length; i++){
        const { from, to, flow } = data[i];
        const fromNode = nodes.get(from) ?? {
            key: from,
            in: 0,
            out: 0,
            size: 0,
            from: [],
            to: []
        };
        const toNode = (from === to ? fromNode : nodes.get(to)) ?? {
            key: to,
            in: 0,
            out: 0,
            size: 0,
            from: [],
            to: []
        };
        fromNode.out += flow;
        fromNode.to.push({
            key: to,
            flow: flow,
            index: i,
            node: toNode,
            addY: 0
        });
        if (fromNode.to.length === 1) {
            nodes.set(from, fromNode);
        }
        toNode.in += flow;
        toNode.from.push({
            key: from,
            flow: flow,
            index: i,
            node: fromNode,
            addY: 0
        });
        if (toNode.from.length === 1) {
            nodes.set(to, toNode);
        }
    }
    setSizes(nodes, size);
    setPriorities(nodes, priority);
    setColumns(nodes, column);
    return nodes;
}

const SMALL_VALUE = 1e-6;
 const getAllKeysForward = (nodes, visited = new Set())=>{
    const keys = [];
    for (const node of nodes){
        if (visited.has(node.key)) continue;
        visited.add(node.key);
        keys.push(node.key, ...getAllKeysForward(node.to.map((to)=>to.node), visited));
    }
    return keys;
};
 const startColumn = (data, nodes)=>{
    const startNodes = nodes.filter((node)=>node.from.length === 0);
    const column = startNodes.map((node)=>node.key);
    const startRef = getAllKeysForward(startNodes);
    const referencedNodes = new Set(startRef);
    for (const point of data){
        if (!referencedNodes.has(point.from) && !referencedNodes.has(point.to)) {
            column.push(point.from);
            referencedNodes.add(point.from);
        }
        referencedNodes.add(point.to);
    }
    return column;
};
 const nextColumn = (dataWithoutDirectLoops, remainingKeys)=>{
    const remainingTo = new Set(dataWithoutDirectLoops.filter((flow)=>remainingKeys.has(flow.from)).map((flow)=>flow.to));
    const remainingKeyArray = [
        ...remainingKeys
    ];
    const columnsNotInTo = remainingKeyArray.filter((key)=>!remainingTo.has(key));
    return columnsNotInTo.length ? columnsNotInTo : remainingKeyArray.slice(0, 1);
};
function calculateX(nodeMap, data, mode) {
    const dataWithoutDirectLoops = data.filter((dp)=>dp.from !== dp.to);
    const allKeys = [
        ...nodeMap.keys()
    ];
    const allNodes = [
        ...nodeMap.values()
    ];
    const keysToPlace = new Set(allKeys);
    let x = 0;
    while(keysToPlace.size){
        const column = x === 0 ? startColumn(data, allNodes) : nextColumn(dataWithoutDirectLoops, keysToPlace);
        if (!column.length) {
            throw new Error('Fatal error: Unable to place nodes to columns. Please report this issue.');
        }
        for (const key of column){
            const node = nodeMap.get(key);
            if (node && !defined(node.x)) {
                node.x = x;
            }
            keysToPlace.delete(key);
        }
        if (keysToPlace.size) {
            x++;
        }
    }
    const maxX = allNodes.reduce((max, node)=>Math.max(max, node.x), 0);
    if (mode === 'edge') {
        const from = new Set(data.map((dataPoint)=>dataPoint.from));
        allKeys.filter((key)=>!from.has(key)).forEach((key)=>{
            const node = nodeMap.get(key);
            if (node && !node.column) {
                node.x = maxX;
            }
        });
    }
    return maxX;
}
let prevCountId = -1;
function getCountId() {
    prevCountId = prevCountId < 100 ? prevCountId + 1 : 0;
    return prevCountId;
}
function nodeCount(list, prop, countId = getCountId()) {
    let count = 0;
    for (const elem of list){
        if (elem.node._visited === countId) {
            continue;
        }
        elem.node._visited = countId;
        count += elem.node[prop].length + nodeCount(elem.node[prop], prop, countId);
    }
    return count;
}
const flowByNodeCount = (prop)=>(a, b)=>nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop) || a.node[prop].length - b.node[prop].length;
function processFrom(node, y) {
    if (!node.from.length) return y;
    node.from.sort(flowByNodeCount('from'));
    for (const flow of node.from){
        const n = flow.node;
        if (!defined(n.y)) {
            n.y = y;
            processFrom(n, y ? y + SMALL_VALUE : 0);
        }
        y = Math.max(n.y + n.out, y);
    }
    return node.y + node.size;
}
function processTo(node, y) {
    if (!node.to.length) return y;
    node.to.sort(flowByNodeCount('to'));
    for (const flow of node.to){
        const n = flow.node;
        if (!defined(n.y)) {
            n.y = y;
            processTo(n, y ? y + SMALL_VALUE : 0);
        }
        y = Math.max(n.y + Math.max(n.in, n.out), y);
    }
    return node.y + node.size;
}
function setOrGetY(node, value) {
    if (defined(node.y)) {
        return node.y;
    }
    node.y = value;
    return value;
}
function processRest(nodeArray, maxX) {
    const leftNodes = nodeArray.filter((node)=>node.x === 0);
    const rightNodes = nodeArray.filter((node)=>node.x === maxX);
    const leftToDo = leftNodes.filter((node)=>!defined(node.y));
    const rightToDo = rightNodes.filter((node)=>!defined(node.y));
    const centerToDo = nodeArray.filter((node)=>node.x > 0 && node.x < maxX && !defined(node.y));
    let leftY = leftNodes.reduce((acc, cur)=>Math.max(acc, cur.y + cur.out || 0), 0) + SMALL_VALUE;
    let rightY = rightNodes.reduce((acc, cur)=>Math.max(acc, cur.y + cur.in || 0), 0) + SMALL_VALUE;
    let centerY = 0;
    if (leftY >= rightY) {
        leftToDo.forEach((node)=>{
            leftY = setOrGetY(node, leftY);
            leftY = Math.max(leftY + node.out, processTo(node, leftY));
        });
        rightToDo.forEach((node)=>{
            rightY = setOrGetY(node, rightY);
            rightY = Math.max(rightY + node.in, processFrom(node, rightY));
        });
    } else {
        leftToDo.forEach((node)=>{
            leftY = setOrGetY(node, leftY);
        });
        rightToDo.forEach((node)=>{
            rightY = setOrGetY(node, rightY);
            rightY = Math.max(rightY + node.in, processFrom(node, rightY));
        });
    }
    centerToDo.forEach((node)=>{
        let y = nodeArray.filter((n)=>n.x === node.x && defined(n.y)).reduce((acc, cur)=>Math.max(acc, cur.y + Math.max(cur.in, cur.out)), 0);
        y = setOrGetY(node, y);
        y = Math.max(y + node.in, processFrom(node, y));
        y = Math.max(y + node.out, processTo(node, y));
        centerY = Math.max(centerY, y);
    });
    return Math.max(leftY, rightY, centerY);
}
const fixTop = (nodeArray, maxX)=>{
    let maxY = 0;
    for(let x = 0; x <= maxX; x++){
        const nodes = nodeArray.filter((n)=>n.x === x).sort((a, b)=>a.y - b.y);
        let minY = 0;
        for (const node of nodes){
            if (node.y < minY) node.y = minY;
            minY = node.y + node.size;
        }
        maxY = Math.max(maxY, minY);
    }
    return maxY;
};
const findStartNode = (nodeArray, maxX)=>{
    const size = [
        ...nodeArray
    ].sort((a, b)=>a.size - b.size).pop().size;
    const biggest = nodeArray.filter((n)=>n.size === size);
    if (biggest.length === 1) return biggest[0];
    biggest.sort((a, b)=>a.x - b.x);
    if (biggest[0].x === 0) return biggest[0];
    if (biggest[biggest.length - 1].x === maxX) return biggest.pop();
    const mid = Math.floor(biggest.length / 2);
    return biggest[mid];
};
function calculateY(nodeArray, maxX) {
    if (!nodeArray.length) return 0;
    const start = findStartNode(nodeArray, maxX);
    start.y = 0;
    processFrom(start, 0);
    processTo(start, 0);
    processRest(nodeArray, maxX);
    return fixTop(nodeArray, maxX);
}
function calculateYUsingPriority(nodeArray, maxX) {
    let maxY = 0;
    let nextYStart = 0;
    for(let x = 0; x <= maxX; x++){
        let y = nextYStart;
        const nodes = nodeArray.filter((node)=>node.x === x).sort((a, b)=>(a.priority ?? 0) - (b.priority ?? 0));
        nextYStart = nodes.length ? nodes[0].to.filter((to)=>to.node.x > x + 1).reduce((acc, cur)=>acc + cur.flow, 0) || 0 : 0;
        for (const node of nodes){
            node.y = y;
            y += Math.max(node.out, node.in);
        }
        maxY = Math.max(y, maxY);
    }
    return maxY;
}
const nodeByXYSize = (a, b)=>{
    if (a.x !== b.x) return a.x - b.x;
    if (a.y === b.y) return a.size - b.size;
    return a.y - b.y;
};
 function addPadding(nodeArray, padding, nodeVerticalPadding) {
    let maxY = 0;
    const columnXs = new Map();
    const grid = [];
    const getColIndex = (x)=>{
        if (!columnXs.has(x)) {
            columnXs.set(x, grid.length);
            grid.push([]);
        }
        return columnXs.get(x);
    };
    nodeArray.sort(nodeByXYSize);
    for (const node of nodeArray){
        const colIdx = getColIndex(node.x);
        const column = grid[colIdx];
        if (node.y) {
            column.push(node.y);
            let paddings = column.length;
            if (node.in) {
                for(let col = 0; col < colIdx; col++){
                    const otherColumn = grid[col];
                    for(let row = 0; row < otherColumn.length; row++){
                        if (otherColumn[row] > node.y) break;
                        paddings = Math.max(row + 1, paddings);
                    }
                }
                while(column.length < paddings)column.push(node.y);
            }
            const verticalPadding = nodeVerticalPadding?.[node.key] || {
                top: 0,
                bottom: 0
            };
            node.y += paddings * padding + verticalPadding.top;
            maxY = Math.max(maxY, node.y + Math.max(node.in, node.out) + verticalPadding.bottom);
        }
    }
    return maxY;
}
function sortFlows(nodeArray) {
    nodeArray.forEach((node)=>{
        const nodeSize = node.size;
        const overlapFrom = nodeSize < node.in;
        const overlapTo = nodeSize < node.out;
        let addY = 0;
        let len = node.from.length;
        node.from.sort((a, b)=>a.node.y + a.node.out / 2 - (b.node.y + b.node.out / 2)).forEach((flow, idx)=>{
            if (overlapFrom) {
                flow.addY = idx * (nodeSize - flow.flow) / (len - 1);
            } else {
                flow.addY = addY;
                addY += flow.flow;
            }
        });
        addY = 0;
        len = node.to.length;
        node.to.sort((a, b)=>a.node.y + a.node.in / 2 - (b.node.y + b.node.in / 2)).forEach((flow, idx)=>{
            if (overlapTo) {
                flow.addY = idx * (nodeSize - flow.flow) / (len - 1);
            } else {
                flow.addY = addY;
                addY += flow.flow;
            }
        });
    });
}
function layout(nodes, data, { priority, height, nodePadding, modeX, nodeVerticalPadding }) {
    const nodeArray = [
        ...nodes.values()
    ];
    const maxX = calculateX(nodes, data, modeX);
    const maxY = priority ? calculateYUsingPriority(nodeArray, maxX) : calculateY(nodeArray, maxX);
    const padding = maxY / height * nodePadding;
    const maxYWithPadding = addPadding(nodeArray, padding, nodeVerticalPadding);
    sortFlows(nodeArray);
    return {
        maxX,
        maxY: maxYWithPadding
    };
}

function getAddY(arr, key, index) {
    for (const item of arr){
        if (item.key === key && item.index === index) {
            return item.addY;
        }
    }
    return 0;
}
class SankeyController extends DatasetController {
    parseObjectData(meta, data, start, count) {
        const sankeyData = getParsedData(data, this.options.parsing);
        const { xScale, yScale } = meta;
        const parsed = [];
        const nodes = this._nodes = buildNodesFromData(sankeyData, this.options);
        const { maxX, maxY } = layout(nodes, sankeyData, {
            priority: !!this.options.priority,
            height: this.chart.canvas.height,
            nodePadding: this.options.nodePadding,
            modeX: this.options.modeX,
            nodeVerticalPadding: this.options.nodeVerticalPadding
        });
        this._maxX = maxX;
        this._maxY = maxY;
        if (!xScale || !yScale) return [];
        for(let i = 0, ilen = sankeyData.length; i < ilen; ++i){
            const dataPoint = sankeyData[i];
            const from = nodes.get(dataPoint.from);
            const to = nodes.get(dataPoint.to);
            if (!from || !to) continue;
            const fromY = (from.y ?? 0) + getAddY(from.to, dataPoint.to, i);
            const toY = (to.y ?? 0) + getAddY(to.from, dataPoint.from, i);
            parsed.push({
                x: xScale.parse(from.x, i),
                y: yScale.parse(fromY, i),
                _custom: {
                    from,
                    to,
                    x: xScale.parse(to.x, i),
                    y: yScale.parse(toY, i),
                    height: yScale.parse(dataPoint.flow, i),
                    flow: dataPoint.flow
                }
            });
        }
        return parsed.slice(start, start + count);
    }
    getMinMax(scale) {
        return {
            min: 0,
            max: scale === this._cachedMeta.xScale ? this._maxX : this._maxY
        };
    }
    update(mode) {
        const { data } = this._cachedMeta;
        this.updateElements(data, 0, data.length, mode);
    }
    updateElements(elems, start, count, mode) {
        const { xScale, yScale } = this._cachedMeta;
        if (!xScale || !yScale) return;
        const firstOpts = this.resolveDataElementOptions(start, mode);
        const sharedOptions = this.getSharedOptions(firstOpts);
        const { borderWidth, nodeWidth = 10 } = this.options;
        const borderSpace = borderWidth ? borderWidth / 2 + 0.5 : 0;
        for(let i = start; i < start + count; i++){
            const parsed = this.getParsed(i);
            const custom = parsed._custom;
            const y = yScale.getPixelForValue(parsed.y);
            this.updateElement(elems[i], i, {
                x: xScale.getPixelForValue(parsed.x) + nodeWidth + borderSpace,
                y,
                x2: xScale.getPixelForValue(custom.x) - borderSpace,
                y2: yScale.getPixelForValue(custom.y),
                from: custom.from,
                to: custom.to,
                progress: mode === 'reset' ? 0 : 1,
                height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
                options: this.resolveDataElementOptions(i, mode)
            }, mode);
        }
        this.updateSharedOptions(sharedOptions, mode, firstOpts);
    }
    _drawLabels() {
        const ctx = this.chart.ctx;
        const options = this.options;
        const nodes = this._nodes || new Map();
        const size = validateSizeValue(options.size);
        const borderWidth = options.borderWidth ?? 1;
        const nodeWidth = options.nodeWidth ?? 10;
        const labels = options.labels;
        const { xScale, yScale } = this._cachedMeta;
        if (!xScale || !yScale) return;
        ctx.save();
        const chartArea = this.chart.chartArea;
        for (const node of nodes.values()){
            const x = xScale.getPixelForValue(node.x);
            const y = yScale.getPixelForValue(node.y);
            const max = Math[size](node.in || node.out, node.out || node.in);
            const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
            const label = labels?.[node.key] ?? node.key;
            let textX = x;
            ctx.fillStyle = options.color ?? 'black';
            ctx.textBaseline = 'middle';
            if (x < chartArea.width / 2) {
                ctx.textAlign = 'left';
                textX += nodeWidth + borderWidth + 4;
            } else {
                ctx.textAlign = 'right';
                textX -= borderWidth + 4;
            }
            this._drawLabel(label, y, height, ctx, textX);
        }
        ctx.restore();
    }
    _drawLabel(label, y, height, ctx, textX) {
        const font = toFont(this.options.font, this.chart.options.font);
        const lines = toTextLines(label);
        const lineCount = lines.length;
        const middle = y + height / 2;
        const textHeight = font.lineHeight;
        const padding = valueOrDefault(this.options.padding, textHeight / 2);
        ctx.font = font.string;
        if (lineCount > 1) {
            const top = middle - textHeight * lineCount / 2 + padding;
            for(let i = 0; i < lineCount; i++){
                ctx.fillText(lines[i], textX, top + i * textHeight);
            }
        } else {
            ctx.fillText(label, textX, middle);
        }
    }
    _drawNodes() {
        const ctx = this.chart.ctx;
        const nodes = this._nodes || new Map();
        const { borderColor, borderWidth = 0, nodeWidth = 10, size } = this.options;
        const sizeMethod = validateSizeValue(size);
        const { xScale, yScale } = this._cachedMeta;
        ctx.save();
        if (borderColor && borderWidth) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
        }
        for (const node of nodes.values()){
            ctx.fillStyle = node.color ?? 'black';
            const x = xScale.getPixelForValue(node.x);
            const y = yScale.getPixelForValue(node.y);
            const max = Math[sizeMethod](node.in || node.out, node.out || node.in);
            const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
            if (borderWidth) {
                ctx.strokeRect(x, y, nodeWidth, height);
            }
            ctx.fillRect(x, y, nodeWidth, height);
        }
        ctx.restore();
    }
 draw() {
        const ctx = this.chart.ctx;
        const data = this.getMeta().data ?? [];
        const active = [];
        for(let i = 0, ilen = data.length; i < ilen; ++i){
            const flow = data[i];
             flow.from.color = flow.options.colorFrom;
            flow.to.color = flow.options.colorTo;
            if (flow.active) {
                active.push(flow);
            }
        }
        for (const flow of active){
            flow.from.color = flow.options.colorFrom;
            flow.to.color = flow.options.colorTo;
        }
        this._drawNodes();
        for(let i = 0, ilen = data.length; i < ilen; ++i){
            data[i].draw(ctx);
        }
        this._drawLabels();
    }
}
SankeyController.id = 'sankey';
SankeyController.defaults = {
    dataElementType: 'flow',
    animations: {
        numbers: {
            type: 'number',
            properties: [
                'x',
                'y',
                'x2',
                'y2',
                'height'
            ]
        },
        progress: {
            easing: 'linear',
            duration: (ctx)=>ctx.type === 'data' ? (ctx.parsed._custom.x - ctx.parsed.x) * 200 : undefined,
            delay: (ctx)=>ctx.type === 'data' ? ctx.parsed.x * 500 + ctx.dataIndex * 20 : undefined
        },
        colors: {
            type: 'color',
            properties: [
                'colorFrom',
                'colorTo'
            ]
        }
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
                    properties: [
                        'colorFrom',
                        'colorTo'
                    ],
                    to: 'transparent'
                }
            }
        },
        show: {
            animations: {
                colors: {
                    type: 'color',
                    properties: [
                        'colorFrom',
                        'colorTo'
                    ],
                    from: 'transparent'
                }
            }
        }
    }
};
SankeyController.overrides = {
    interaction: {
        mode: 'nearest',
        intersect: true
    },
    datasets: {
        clip: false,
        parsing: {
            from: 'from',
            to: 'to',
            flow: 'flow'
        }
    },
    plugins: {
        tooltip: {
            callbacks: {
                title () {
                    return '';
                },
                label (context) {
                    const parsedCustom = context.parsed._custom;
                    return parsedCustom.from.key + ' -> ' + parsedCustom.to.key + ': ' + parsedCustom.flow;
                }
            }
        },
        legend: {
            display: false
        }
    },
    scales: {
        x: {
            type: 'linear',
            bounds: 'data',
            display: false,
            min: 0,
            offset: false
        },
        y: {
            type: 'linear',
            bounds: 'data',
            display: false,
            min: 0,
            reverse: true,
            offset: false
        }
    },
    layout: {
        padding: {
            top: 3,
            left: 3,
            right: 13,
            bottom: 3
        }
    }
};

const controlPoints = (x, y, x2, y2)=>x < x2 ? {
        cp1: {
            x: x + (x2 - x) / 3 * 2,
            y
        },
        cp2: {
            x: x + (x2 - x) / 3,
            y: y2
        }
    } : {
        cp1: {
            x: x - (x - x2) / 3,
            y: 0
        },
        cp2: {
            x: x2 + (x - x2) / 3,
            y: 0
        }
    };
const pointInLine = (p1, p2, t)=>({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
    });
const applyAlpha = (original, alpha)=>color(original).alpha(alpha).rgbString();
const getColorOption = (option, alpha)=>typeof option === 'string' ? applyAlpha(option, alpha) : option;
function setStyle(ctx, { x, x2, options }) {
    let fill = 'black';
    if (options.colorMode === 'from') {
        fill = getColorOption(options.colorFrom, options.alpha);
    } else if (options.colorMode === 'to') {
        fill = getColorOption(options.colorTo, options.alpha);
    } else if (typeof options.colorFrom === 'string' && typeof options.colorTo === 'string') {
        fill = ctx.createLinearGradient(x, 0, x2, 0);
        fill.addColorStop(0, applyAlpha(options.colorFrom, options.alpha));
        fill.addColorStop(1, applyAlpha(options.colorTo, options.alpha));
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 0.5;
}
class Flow extends Element {
 draw(ctx) {
        const { x, x2, y, y2, height, progress } = this;
        const { cp1, cp2 } = controlPoints(x, y, x2, y2);
        if (progress === 0) {
            return;
        }
        ctx.save();
        if (progress < 1) {
            ctx.beginPath();
            ctx.rect(x, Math.min(y, y2), (x2 - x) * progress + 1, Math.abs(y2 - y) + height + 1);
            ctx.clip();
        }
        setStyle(ctx, this);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2);
        ctx.lineTo(x2, y2 + height);
        ctx.bezierCurveTo(cp2.x, cp2.y + height, cp1.x, cp1.y + height, x, y + height);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
 inRange(mouseX, mouseY, useFinalPosition) {
        const { x, y, x2, y2, height } = this.getProps([
            'x',
            'y',
            'x2',
            'y2',
            'height'
        ], useFinalPosition);
        if (mouseX < x || mouseX > x2) {
            return false;
        }
        const { cp1, cp2 } = controlPoints(x, y, x2, y2);
        const t = (mouseX - x) / (x2 - x);
        const p1 = {
            x,
            y
        };
        const p2 = {
            x: x2,
            y: y2
        };
        const a = pointInLine(p1, cp1, t);
        const b = pointInLine(cp1, cp2, t);
        const c = pointInLine(cp2, p2, t);
        const d = pointInLine(a, b, t);
        const e = pointInLine(b, c, t);
        const topY = pointInLine(d, e, t).y;
        return mouseY >= topY && mouseY <= topY + height;
    }
 inXRange(mouseX, useFinalPosition) {
        const { x, x2 } = this.getProps([
            'x',
            'x2'
        ], useFinalPosition);
        return mouseX >= x && mouseX <= x2;
    }
 inYRange(mouseY, useFinalPosition) {
        const { y, y2, height } = this.getProps([
            'y',
            'y2',
            'height'
        ], useFinalPosition);
        const minY = Math.min(y, y2);
        const maxY = Math.max(y, y2) + height;
        return mouseY >= minY && mouseY <= maxY;
    }
 getCenterPoint(useFinalPosition) {
        const { x, y, x2, y2, height } = this.getProps([
            'x',
            'y',
            'x2',
            'y2',
            'height'
        ], useFinalPosition);
        return {
            x: (x + x2) / 2,
            y: (y + y2 + height) / 2
        };
    }
    tooltipPosition(useFinalPosition) {
        return this.getCenterPoint(useFinalPosition);
    }
 getRange(axis) {
        return axis === 'x' ? this.width / 2 : this.height / 2;
    }
    constructor(cfg){
        super();
        if (cfg) {
            Object.assign(this, cfg);
        }
    }
}
Flow.id = 'flow';
Flow.defaults = {
    colorFrom: 'red',
    colorTo: 'green',
    colorMode: 'gradient',
    alpha: 0.5,
    hoverColorFrom: (_ctx, options)=>getHoverColor(options.colorFrom),
    hoverColorTo: (_ctx, options)=>getHoverColor(options.colorTo)
};
Flow.descriptors = {
    _scriptable: true
};

export { Flow, SankeyController };
