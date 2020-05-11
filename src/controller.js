'use strict';

import Chart from 'chart.js';
import Flow from './flow';

export function buildNodesFromFlows(data) {
	const nodes = new Map();
	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		if (!nodes.has(d.from)) {
			nodes.set(d.from, {in: 0, out: d.flow, from: [], to: [d.to]});
		} else {
			const node = nodes.get(d.from);
			node.out += d.flow;
			node.from.push(d.to);
		}
		if (!nodes.has(d.to)) {
			nodes.set(d.to, {in: d.flow, out: 0, from: [d.from], to: []});
		} else {
			const node = nodes.get(d.to);
			node.in += d.flow;
			node.from.push(d.from);
		}
	}
	[...nodes.values()].forEach(node => {
		const from = node.from;
		node.from = [];
		from.forEach(x => node.from.push(nodes.get(x)));
		const to = node.to;
		node.to = [];
		to.forEach(x => node.to.push(nodes.get(x)));
	});
	return nodes;
}

export function parseLevelsFromFlows(nodes, data) {
	const to = new Set(data.map(x => x.to));
	const from = new Set(data.map(x => x.from));
	const levels = new Map();
	const keys = new Set([...nodes.keys()]);
	let lvl = 0;
	while (keys.size) {
		const level = [...keys].filter(x => !to.has(x));
		for (let i = 0; i < level.length; i++) {
			levels.set(level[i], lvl);
			keys.delete(level[i]);
		}
		if (keys.size) {
			to.clear();
			data.filter(x => keys.has(x.from)).forEach(x => to.add(x.to));
			lvl++;
		}
	}
	[...nodes.keys()].filter(x => !from.has(x)).forEach(x => levels.set(x, lvl));
	return levels;
}

function calculateYForNodes(nodes, levels) {
	const cache = {};
	const ret = {};
	[...nodes.keys()]
		.sort((a, b) => {
			const la = levels.get(a);
			const lb = levels.get(b);
			const ia = nodes.get(a);
			const ib = nodes.get(b);
			return la === lb
				? ia.in === ib.in
					? ib.out - ia.out
					: ib.in - ia.in
				: la - lb;
		}).forEach(node => {
			const lvl = levels.get(node);
			const y = cache[lvl] || (cache[lvl] = 0);
			ret[node] = y;
			const {in: _in, out} = nodes.get(node);
			cache[lvl] += Math.max(_in, out) + 1;
		});
	return ret;
}

export default class SankeyController extends Chart.DatasetController {

	parseObjectData(meta, data, start, count) {
		const me = this;
		const {xScale, yScale} = meta;
		const parsed = [];
		const nodes = me._nodes = buildNodesFromFlows(data);
		const levels = me._levels = parseLevelsFromFlows(nodes, data);
		const nodeY1 = calculateYForNodes(nodes, levels);
		const nodeY2 = calculateYForNodes(nodes, levels);

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const flow = data[i];
			const fromLevel = levels.get(flow.from);
			const toLevel = levels.get(flow.to);
			const y = nodeY1[flow.from];
			const y2 = nodeY2[flow.to];
			parsed.push({
				x: xScale.parse(fromLevel, i),
				y: yScale.parse(y, i),
				_custom: {
					from: flow.from,
					to: flow.to,
					x: xScale.parse(toLevel, i),
					y: yScale.parse(y2, i),
					height: yScale.parse(flow.flow, i),
				}
			});
			nodeY1[flow.from] += flow.flow;
			nodeY2[flow.to] += flow.flow;
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

	_drawNodes(ctx, colors) {
		const me = this;
		const nodes = me._nodes || new Map();
		const levels = me._levels || new Map();
		const nodeY = calculateYForNodes(nodes, levels);
		const {xScale, yScale} = me._cachedMeta;
		ctx.save();
		ctx.strokeStyle = 'black';
		const areaWidth = me.chart.chartArea.width;
		for (const [key, value] of nodes.entries()) {
			ctx.fillStyle = colors.get(key);
			const x = xScale.getPixelForValue(levels.get(key));
			const y = yScale.getPixelForValue(nodeY[key]);
			const max = Math.max(value.in, value.out);
			const height = Math.abs(yScale.getPixelForValue(nodeY[key] + max) - y);
			ctx.strokeRect(x, y, 10, height);
			ctx.fillRect(x, y, 10, height);
			if (height > 12) {
				ctx.fillStyle = 'black';
				ctx.textBaseline = 'middle';
				if (x < areaWidth / 2) {
					ctx.textAlign = 'left';
					ctx.fillText(key, x + 15, y + height / 2);
				} else {
					ctx.textAlign = 'right';
					ctx.fillText(key, x - 5, y + height / 2);
				}
			}
		}
		ctx.restore();
	}

	draw() {
		const me = this;
		const ctx = me._ctx;
		const data = me.getMeta().data || [];
		const colors = new Map();

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const flow = data[i];
			flow.draw(ctx);
			colors.set(flow.from, flow.options.colorFrom);
			colors.set(flow.to, flow.options.colorTo);
		}

		me._drawNodes(ctx, colors);
	}
}

SankeyController.prototype.dataElementType = Flow;

SankeyController.prototype.dataElementOptions = [
	'colorFrom',
	'colorTo'
];
