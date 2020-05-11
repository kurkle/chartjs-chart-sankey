'use strict';

import Chart from 'chart.js';
import Flow from './flow';

function parseItemsFromFlows(data) {
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

function parseLevelsFromFlows(items, data) {
	const to = new Set(data.map(x => x.to));
	const from = new Set(data.map(x => x.from));
	const levels = new Map();
	let work = [...items.keys()];
	let lvl = 0;
	while (work.length) {
		const level = work.filter(x => !to.has(x));
		work = work.filter(x => to.has(x));
		for (let i = 0; i < level.length; i++) {
			levels.set(level[i], lvl);
		}
		if (!level.length) {
			for (let i = 0; i < work.length; i++) {
				levels.set(work[i], lvl);
			}
			work = [];
		}
		lvl++;
	}
	[...items.keys()].filter(x => !from.has(x)).forEach(x => levels.set(x, lvl));
	return levels;
}

function calculateYForItems(items, levels) {
	const cache = {};
	const ret = {};
	[...items.keys()].forEach(item => {
		const lvl = levels.get(item);
		const y = cache[lvl] || (cache[lvl] = lvl % 2);
		ret[item] = y;
		const {in: _in, out} = items.get(item);
		cache[lvl] += Math.max(_in, out) + 1;

	});
	return ret;
}

export default class SankeyController extends Chart.DatasetController {

	parseObjectData(meta, data, start, count) {
		const {xScale, yScale} = meta;
		const parsed = [];
		const items = parseItemsFromFlows(data);
		const levels = parseLevelsFromFlows(items, data);
		const itemY = calculateYForItems(items, levels);

		for (let i = 0, ilen = data.length; i < ilen; ++i) {
			const item = data[i];
			const y = itemY[item.from];
			const y2 = itemY[item.to];
			const itm = items.get(item.from);
			parsed.push({
				x: xScale.parse(levels.get(item.from), i),
				y: yScale.parse(y - itm.in, i),
				_custom: {
					x: xScale.parse(levels.get(item.to), i),
					y: yScale.parse(y2, i),
					height: yScale.parse(item.flow, i),
				}
			});
			itemY[item.from] += item.flow;
			itemY[item.to] += item.flow;
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
					x: xScale.getPixelForValue(parsed.x),
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
		const data = me.getMeta().data || [];
		let i, ilen;

		for (i = 0, ilen = data.length; i < ilen; ++i) {
			data[i].draw(me._ctx);
		}
	}
}

SankeyController.prototype.dataElementType = Flow;

SankeyController.prototype.dataElementOptions = [
	'colorFrom',
	'colorTo'
];
