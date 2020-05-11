import Chart from 'chart.js';
import {parseItemsFromFlows, parseLevelsFromFlows} from '../../src/controller.js';

describe('auto', jasmine.fixture.specs(''));

describe('controller', function() {
	it('should be registered', function() {
		expect(Chart.controllers.sankey).toBeDefined();
	});

	it('should parse simple flows', function() {
		const data = [{from: 'a', to: 'b', flow: 1}];

		const items = parseItemsFromFlows(data);
		expect(items.size).toEqual(2);
		expect(items.get('a')).toEqual(jasmine.objectContaining({in: 0, out: 1}));
		expect(items.get('b')).toEqual(jasmine.objectContaining({in: 1, out: 0}));

		const levels = parseLevelsFromFlows(items, data);
		expect(levels.size).toEqual(2);
		expect(levels.get('a')).toEqual(0);
		expect(levels.get('b')).toEqual(1);
	});

	it('should parse items from complex flows', function() {
		const data = [
			{from: 'Coal imports', to: 'Coal', flow: 11.606},
			{from: 'Coal reserves', to: 'Coal', flow: 63.965},
			{from: 'Coal', to: 'Solid', flow: 75.571},
			{from: 'Bio-conversion', to: 'Solid', flow: 280.322},
			{from: 'Biomass imports', to: 'Solid', flow: 35},
			{from: 'Other waste', to: 'Solid', flow: 56.587},
			{from: 'Solid', to: 'Agriculture', flow: 0.882},
		];
		const items = parseItemsFromFlows(data);
		expect(items.size).toEqual(8);
		expect(items.get('Coal imports')).toEqual(jasmine.objectContaining({in: 0, out: 11.606}));
		expect(items.get('Coal reserves')).toEqual(jasmine.objectContaining({in: 0, out: 63.965}));
		expect(items.get('Coal')).toEqual(jasmine.objectContaining({in: 75.571, out: 75.571}));
		expect(items.get('Bio-conversion')).toEqual(jasmine.objectContaining({in: 0, out: 280.322}));
		expect(items.get('Biomass imports')).toEqual(jasmine.objectContaining({in: 0, out: 35}));
		expect(items.get('Other waste')).toEqual(jasmine.objectContaining({in: 0, out: 56.587}));
		expect(items.get('Solid')).toEqual(jasmine.objectContaining({in: 447.48, out: 0.882}));
		expect(items.get('Agriculture')).toEqual(jasmine.objectContaining({in: 0.882, out: 0}));

		const levels = parseLevelsFromFlows(items, data);
		expect(levels.size).toEqual(8);
		expect(levels.get('Coal imports')).toEqual(0);
		expect(levels.get('Coal reserves')).toEqual(0);
		expect(levels.get('Coal')).toEqual(1);
		expect(levels.get('Bio-conversion')).toEqual(0);
		expect(levels.get('Biomass imports')).toEqual(0);
		expect(levels.get('Other waste')).toEqual(0);
		expect(levels.get('Solid')).toEqual(2);
		expect(levels.get('Agriculture')).toEqual(3);
	});
});
