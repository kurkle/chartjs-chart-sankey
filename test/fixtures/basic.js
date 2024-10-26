module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          data: [
            {from: 'a', to: 'b', flow: 20},
            {from: 'c', to: 'd', flow: 10},
            {from: 'c', to: 'e', flow: 5},
          ],
          colorFrom: 'red',
          colorTo: 'green'
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
