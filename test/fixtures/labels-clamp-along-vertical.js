// Labels that are not placed beside their node's column can leave the canvas along the rows:
// a label drawn on a node of the first or last row, or above/below a node at the left or right edge.
// Each label is shifted back inside the canvas along the column axis, without being nudged
// against other labels.
export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data: [
            { flow: 10, from: 'source', to: 'first target' },
            { flow: 3, from: 'source', to: 'second target' },
          ],
          labels: { source: 'Source node', 'first target': 'First target', 'second target': 'Second target' },
          nodeLabels: {
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 3,
            padding: 4,
            position: { source: 'center', 'first target': 'center', 'second target': 'bottom' },
          },
          orientation: 'vertical',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'Vertical chart: labels centred on the nodes of the first and last row, and below the last node, are shifted back inside the canvas.',
  options: {
    canvas: {
      height: 240,
      width: 200,
    },
    spriteText: true,
  },
  tolerance: 0.02,
}
