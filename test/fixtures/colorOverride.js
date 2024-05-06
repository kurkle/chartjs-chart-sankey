module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          label: 'My sankey',
          data: [
            {from: 'a0', to: 'a', flow: 4, colorOverride: '#0afe'},
            {from: 'b0', to: 'a', flow: 4, colorOverride: '#ff0'},
            {from: 'c0', to: 'a', flow: 2, colorOverride: 'brown'},
            {from: 'a', to: 'b', flow: 10, colorOverride: 'teal'},
            {from: 'b', to: 'a1', flow: 6, colorOverride: 'blue'},
            {from: 'b', to: 'b1', flow: 2, colorOverride: 'orange'},
            {from: 'b', to: 'c1', flow: 2, colorOverride: 'grey'},
          ],
          column: {
            a: 1.5,
            b: 1.6,
            a1: 3,
            b1: 3,
            c1: 3
          },
        }
      ]
    }
  },
  options: {
    canvas: {
      height: 256,
      width: 512
    }
  }
};
