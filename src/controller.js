'use strict';

import Chart from 'chart.js';
import Flow from './flow';

export function buildNodesFromFlows(data) {
	const nodes = new Map();
	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		if (!nodes.has(d.from)) {
			nodes.set(d.from, {key: d.from, in: 0, out: d.flow, from: [], to: [{key: d.to, flow: d.flow}]});
		} else {
			const node = nodes.get(d.from);
			node.out += d.flow;
			node.to.push({key: d.to, flow: d.flow});
		}
		if (!nodes.has(d.to)) {
			nodes.set(d.to, {key: d.to, in: d.flow, out: 0, from: [{key: d.from, flow: d.flow}], to: []});
		} else {
			const node = nodes.get(d.to);
			node.in += d.flow;
			node.from.push({key: d.from, flow: d.flow});
		}
	}

	const flowSort = (a, b) => b.flow - a.flow;

	[...nodes.values()].forEach(node => {
		let tmp = 0;
		node.from = node.from.sort(flowSort);
		node.from.forEach(x => {
			x.node = nodes.get(x.key);
			x.addY = tmp;
			tmp += x.flow;
		});

		tmp = 0;
		node.to = node.to.sort(flowSort);
		node.to.forEach(x => {
			x.node = nodes.get(x.key);
			x.addY = tmp;
			tmp += x.flow;
		});
	});

	return nodes;
}

export function calculateX(nodes, data) {
	const to = new Set(data.map(x => x.to));
	const from = new Set(data.map(x => x.from));
	const keys = new Set([...nodes.keys()]);
	let lvl = 0;
	while (keys.size) {
		const column = [...keys].filter(x => !to.has(x));
		for (let i = 0; i < column.length; i++) {
			nodes.get(column[i]).x = lvl;
			keys.delete(column[i]);
		}
		if (keys.size) {
			to.clear();
			data.filter(x => keys.has(x.from)).forEach(x => to.add(x.to));
			lvl++;
		}
	}
	[...nodes.keys()]
		.filter(key => !from.has(key))
		.forEach(key => {
			nodes.get(key).x = lvl;
		});
}

function columnSort(nodeA, nodeB) {
	for (let i = 0; i < nodeA.to.length; i++) {
		const toA = nodeA.to[i];
		for (let j = 0; j < nodeB.to.length; j++) {
			const toB = nodeB.to[j];
			if (toA.key === toB.key) {
				return toA.flow - toB.flow;
			}
		}
	}

	const toALen = nodeA.to.length;
	const toBLen = nodeB.to.length;
	return toALen === toBLen
		? nodeB.out - nodeA.out
		: toALen - toBLen;

}

function sortedNodeKeys(nodes) {
	return [...nodes.keys()].sort((a, b) => {
		const nodeA = nodes.get(a);
		const nodeB = nodes.get(b);
		return nodeA.x === nodeB.x
			? columnSort(nodeA, nodeB)
			: nodeA.x - nodeB.x;
	});
}

export function calculateY(nodes) {
	let tmpY = 0;
	let curX = 0;
	let maxY = 0;
	let count = 0;
	let maxCount = 0;
	sortedNodeKeys(nodes).forEach(key => {
		const node = nodes.get(key);
		if (node.x > curX) {
			tmpY = 0;
			curX = node.x;
			count = 0;
		}
		if (node.x === 0) {
			node.y = tmpY;
		} else {
			node.y = Math.max(tmpY, node.from.reduce((acc, cur) => acc + cur.node.y, 0) / node.from.length - node.in);
		}
		tmpY = node.y + Math.max(node.in, node.out);
		count++;
		maxY = Math.max(tmpY, maxY);
		maxCount = Math.max(count, maxCount);
	});
	const padding = maxY / maxCount / 20;
	let i = 0;
	curX = 0;
	sortedNodeKeys(nodes).forEach(key => {
		const node = nodes.get(key);
		if (curX !== node.x) {
			i = 0;
			curX = node.x;
		}
		node.y += i * padding;
		i++;
	});
	return maxY + maxCount * padding;
}

function getAddY(arr, key) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].key === key) {
			return arr[i].addY;
		}
	}
	return 0;
}

export default class SankeyController extends Chart.DatasetController {

	parseObjectData(meta, data, start, count) {
		const me = this;
		const {xScale, yScale} = meta;
		const parsed = [];
		const nodes = me._nodes = buildNodesFromFlows(data);

		calculateX(nodes, data);
		const maxY = calculateY(nodes, data);
		yScale.options.max = maxY;

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const flow = data[i];
			const from = nodes.get(flow.from);
			const to = nodes.get(flow.to);
			const fromY = from.y + getAddY(from.to, flow.to);
			const toY = to.y + getAddY(to.from, flow.from);
			parsed.push({
				x: xScale.parse(from.x, i),
				y: yScale.parse(fromY, i),
				_custom: {
					from,
					to,
					x: xScale.parse(to.x, i),
					y: yScale.parse(toY, i),
					height: yScale.parse(flow.flow, i),
				}
			});
		}
		return parsed.slice(start, start + count);
	}

	update(mode) {
		const me = this;
		const meta = me._cachedMeta;

		me.updateElements(meta.data, 0, mode);
	}

	updateElements(elems, start, mode) {
		const me = this;
		const {xScale, yScale} = me._cachedMeta;
		const firstOpts = me.resolveDataElementOptions(start, mode);
		const sharedOptions = me.getSharedOptions(mode, elems[start], firstOpts);

		for (let i = 0; i < elems.length; i++) {
			const index = start + i;
			const parsed = me.getParsed(index);
			const custom = parsed._custom;
			const y = yScale.getPixelForValue(parsed.y);
			me.updateElement(
				elems[i],
				index,
				{
					x: xScale.getPixelForValue(parsed.x) + 10,
					y,
					x2: xScale.getPixelForValue(custom.x),
					y2: yScale.getPixelForValue(custom.y),
					from: custom.from,
					to: custom.to,
					progress: mode === 'reset' ? 0 : 1,
					height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
					options: me.resolveDataElementOptions(i, mode)
				},
				mode);
		}

		me.updateSharedOptions(sharedOptions, mode);
	}

	_drawNodes() {
		const me = this;
		const ctx = me._ctx;
		const nodes = me._nodes || new Map();
		const {xScale, yScale} = me._cachedMeta;

		ctx.save();
		ctx.strokeStyle = 'black';
		const chartArea = me.chart.chartArea;

		for (const node of nodes.values()) {
			ctx.fillStyle = node.color;
			const x = xScale.getPixelForValue(node.x);
			const y = yScale.getPixelForValue(node.y);
			const max = Math.max(node.in, node.out);
			const height = Math.abs(yScale.getPixelForValue(node.y + max) - y);
			ctx.strokeRect(x, y, 10, height);
			ctx.fillRect(x, y, 10, height);
			if (height > 12) {
				ctx.fillStyle = 'black';
				ctx.textBaseline = 'middle';
				if (x < chartArea.width / 2) {
					ctx.textAlign = 'left';
					ctx.fillText(node.key, x + 15, y + height / 2);
				} else {
					ctx.textAlign = 'right';
					ctx.fillText(node.key, x - 5, y + height / 2);
				}
			}
		}
		ctx.restore();
	}

	draw() {
		const me = this;
		const ctx = me._ctx;
		const data = me.getMeta().data || [];

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const flow = data[i];
			flow.draw(ctx);
			flow.from.color = flow.options.colorFrom;
			flow.to.color = flow.options.colorTo;
		}

		me._drawNodes();
	}
}

SankeyController.prototype.dataElementType = Flow;

SankeyController.prototype.dataElementOptions = [
	'colorFrom',
	'colorTo'
];
