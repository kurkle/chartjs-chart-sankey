// Three small nodes between two big ones, a few pixels apart in one column. Their labels would cover
// each other; each is nudged away from its neighbours by at most half its own
// size, which is enough to make them mostly readable and keeps every label at its node.
export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data: [
            { flow: 100, from: 'Source', to: 'Big A' },
            { flow: 2, from: 'Source', to: 'Small 1' },
            { flow: 2, from: 'Source', to: 'Small 2' },
            { flow: 2, from: 'Source', to: 'Small 3' },
            { flow: 100, from: 'Source', to: 'Big B' },
          ],
          nodeLabels: {
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 3,
            padding: 4,
          },
          priority: { 'Big A': -1, 'Big B': 1 },
          nodePadding: 6,
          orientation: 'horizontal',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'Horizontal chart: three small nodes about 10 px apart in one column. Their labels are nudged apart (at most half a label) and stay at their nodes and inside the chart area.',
  options: {
    canvas: {
      height: 320,
      width: 320,
    },
    spriteText: true,
  },
  tolerance: 0.02,
}
