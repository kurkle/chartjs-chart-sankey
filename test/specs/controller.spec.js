import {Chart} from 'chart.js';
import {buildNodesFromRawData} from '../../src/controller.js';
import {calculateX, calculateY} from '../../src/layout';

describe('auto', jasmine.fixtures(''));

describe('controller', function() {
  it('should be registered', function() {
    expect(Chart.controllers.sankey).toBeDefined();
  });

  it('should parse simple flows', function() {
    const data = [{from: 'a', to: 'b', flow: 1}];

    const nodes = buildNodesFromRawData(data);
    expect(nodes.size).toEqual(2);
    const a = nodes.get('a');
    const b = nodes.get('b');
    expect(a).toEqual(jasmine.objectContaining({in: 0, out: 1}));
    expect(b).toEqual(jasmine.objectContaining({in: 1, out: 0}));

    calculateX(nodes, data);
    expect(a).toEqual(jasmine.objectContaining({x: 0}));
    expect(b).toEqual(jasmine.objectContaining({x: 1}));

    calculateY([...nodes.values()]);
    expect(a).toEqual(jasmine.objectContaining({y: 0}));
    expect(b).toEqual(jasmine.objectContaining({y: 0}));
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
    const nodes = buildNodesFromRawData(data);
    expect(nodes.size).toEqual(8);

    const ci = nodes.get('Coal imports');
    const cr = nodes.get('Coal reserves');
    const co = nodes.get('Coal');
    const bc = nodes.get('Bio-conversion');
    const bi = nodes.get('Biomass imports');
    const ow = nodes.get('Other waste');
    const so = nodes.get('Solid');
    const ag = nodes.get('Agriculture');

    expect(ci).toEqual(jasmine.objectContaining({in: 0, out: 11.606}));
    expect(cr).toEqual(jasmine.objectContaining({in: 0, out: 63.965}));
    expect(co).toEqual(jasmine.objectContaining({in: 75.571, out: 75.571}));
    expect(bc).toEqual(jasmine.objectContaining({in: 0, out: 280.322}));
    expect(bi).toEqual(jasmine.objectContaining({in: 0, out: 35}));
    expect(ow).toEqual(jasmine.objectContaining({in: 0, out: 56.587}));
    expect(so).toEqual(jasmine.objectContaining({in: 447.48, out: 0.882}));
    expect(ag).toEqual(jasmine.objectContaining({in: 0.882, out: 0}));

    calculateX(nodes, data);

    expect(ci).toEqual(jasmine.objectContaining({x: 0}));
    expect(cr).toEqual(jasmine.objectContaining({x: 0}));
    expect(co).toEqual(jasmine.objectContaining({x: 1}));
    expect(bc).toEqual(jasmine.objectContaining({x: 0}));
    expect(bi).toEqual(jasmine.objectContaining({x: 0}));
    expect(ow).toEqual(jasmine.objectContaining({x: 0}));
    expect(so).toEqual(jasmine.objectContaining({x: 2}));
    expect(ag).toEqual(jasmine.objectContaining({x: 3}));
  });
});
