import Chart from 'chart.js';

describe('auto', jasmine.fixture.specs(''));

describe('controller', function() {
	it('should be registered', function() {
		expect(Chart.controllers.sankey).toBeDefined();
	});
});
