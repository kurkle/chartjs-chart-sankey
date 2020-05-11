'use strict';

import Chart from 'chart.js';
import Flow from './flow';

export function parseItemsFromFlows(data) {
	const items = new Map();
	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		if (!items.has(d.from)) {
			items.set(d.from, {in: 0, out: d.flow});
		} else {
			items.get(d.from).out += d.flow;
		}
		if (!items.has(d.to)) {
			items.set(d.to, {in: d.flow, out: 0});
		} else {
			items.get(d.to).in += d.flow;
		}
	}
	return items;
}

export function parseLevelsFromFlows(items, data) {
	const to = new Set(data.map(x => x.to));
	const from = new Set(data.map(x => x.from));
	const levels = new Map();
	const keys = new Set([...items.keys()]);
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
	[...items.keys()].filter(x => !from.has(x)).forEach(x => levels.set(x, lvl));
	return levels;
}

function calculateYForItems(items, levels) {
	const cache = {};
	const ret = {};
	[...items.keys()]
		.sort((a, b) => {
			const la = levels.get(a);
			const lb = levels.get(b);
			const ia = items.get(a);
			const ib = items.get(b);
			return la === lb
				? ia.in === ib.in
					? ib.out - ia.out
					: ib.in - ia.in
				: la - lb;
		}).forEach(item => {
			const lvl = levels.get(item);
			const y = cache[lvl] || (cache[lvl] = 0);
			ret[item] = y;
			const {in: _in, out} = items.get(item);
			cache[lvl] += Math.max(_in, out) + 1;
		});
	return ret;
}

export default class SankeyController extends Chart.DatasetController {

	parseObjectData(meta, data, start, count) {
		const me = this;
		const {xScale, yScale} = meta;
		const parsed = [];
		const items = me._items = parseItemsFromFlows(data);
		const levels = me._levels = parseLevelsFromFlows(items, data);
		const itemY1 = calculateYForItems(items, levels);
		const itemY2 = calculateYForItems(items, levels);

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const item = data[i];
			const fromLevel = levels.get(item.from);
			const toLevel = levels.get(item.to);
			const y = itemY1[item.from];
			const y2 = itemY2[item.to];
			// const itm = items.get(item.from);
			parsed.push({
				x: xScale.parse(fromLevel, i),
				y: yScale.parse(y, i),
				_custom: {
					x: xScale.parse(toLevel, i),
					y: yScale.parse(y2, i),
					height: yScale.parse(item.flow, i),
				}
			});
			itemY1[item.from] += item.flow;
			itemY2[item.to] += item.flow;
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
					progress: mode === 'reset' ? 0 : 1,
					height: Math.abs(yScale.getPixelForValue(parsed.y + custom.height) - y),
					options: me.resolveDataElementOptions(i, mode)
				},
				mode);
		}

		me.updateSharedOptions(sharedOptions, mode);
	}

	draw() {
		const me = this;
		const ctx = me._ctx;
		const items = me._items || new Map();
		const levels = me._levels || new Map();
		const itemY = calculateYForItems(items, levels);
		const {xScale, yScale} = me._cachedMeta;
		const data = me.getMeta().data || [];
		const _data = me.getDataset().data || [];
		const colors = new Map();

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			data[i].draw(ctx);
			colors.set(_data[i].from, data[i].options.colorFrom);
			colors.set(_data[i].to, data[i].options.colorTo);
		}

		ctx.save();
		ctx.strokeStyle = 'black';
		for (const [key, value] of items.entries()) {
			ctx.fillStyle = colors.get(key);
			const x = xScale.getPixelForValue(levels.get(key));
			const y = yScale.getPixelForValue(itemY[key]);
			const max = Math.max(value.in, value.out);
			const height = Math.abs(yScale.getPixelForValue(itemY[key] + max) - y);
			ctx.strokeRect(x, y, 10, height);
			ctx.fillRect(x, y, 10, height);
		}
		ctx.restore();
	}
}

SankeyController.prototype.dataElementType = Flow;

SankeyController.prototype.dataElementOptions = [
	'colorFrom',
	'colorTo'
];
