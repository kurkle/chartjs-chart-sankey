// Labels that are not placed beside their node's column can leave the canvas along the columns:
// a label drawn on a node of the first or last column, or above/below a node at the top or bottom edge.
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
          orientation: 'horizontal',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'Horizontal chart: labels centred on the nodes of the first and last column, and below the last node, are shifted back inside the canvas.',
  options: {
    canvas: {
      height: 200,
      width: 240,
    },
    spriteText: true,
  },
  tolerance: 0.02,
}
