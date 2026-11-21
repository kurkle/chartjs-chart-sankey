// A node whose flow is 0.01x10 sits at the top of its column, so its bar is
// a fraction of a pixel and its multi-line label is taller than the bar.
// The label must be shifted to stay inside the chart area, not cut by the canvas edge.
export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data: [
            { flow: 10, from: 'a', to: 'b' },
            { flow: 0.01, from: 'a', to: 'c' },
          ],
          labels: {
            a: 'Source',
            b: 'Big node\nsecond line',
            c: 'Tiny node\nsecond line\nthird line',
          },
          nodeLabels: {
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 3,
            padding: 4,
          },
          orientation: 'horizontal',
          priority: { b: 1, c: -1 },
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'Horizontal chart: the tiny node is first in its column, at the top edge of the chart area. Its three-line label is shifted down so the whole label box stays inside the chart area.',
  options: {
    canvas: {
      height: 256,
      width: 256,
    },
    spriteText: true,
  },
  tolerance: 0.02,
}
