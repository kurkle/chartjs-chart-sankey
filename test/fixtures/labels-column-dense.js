// Too dense for the labels to be separated: seven tiny nodes land in one column a
// few pixels apart. A label moves at most half its own size from its node, so
// the labels keep overlapping, but each stays at its node, in order, inside the chart area.
const data = [
  { flow: 100, from: 'Source', to: 'Big' },
  { flow: 0.5, from: 'Source', to: 'Tiny 1' },
  { flow: 0.5, from: 'Source', to: 'Tiny 2' },
  { flow: 0.5, from: 'Source', to: 'Tiny 3' },
  { flow: 0.5, from: 'Source', to: 'Tiny 4' },
  { flow: 0.5, from: 'Source', to: 'Tiny 5' },
  { flow: 0.5, from: 'Source', to: 'Tiny 6' },
  { flow: 0.5, from: 'Source', to: 'Tiny 7' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data,
          labels: { Big: 'Big node\nsecond line' },
          nodeLabels: {
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 3,
            padding: 3,
          },
          orientation: 'horizontal',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'Horizontal chart, too dense to separate: seven tiny nodes in one column. Their labels overlap, but none moves further than half its own size from its node and none leaves the chart area.',
  options: {
    canvas: {
      height: 320,
      width: 320,
    },
    spriteText: true,
  },
  tolerance: 0.02,
}
