// Same shape as issue 87: one huge node and several nearly-invisible ones
// (flows of 0.37, 0.5, 0.9 against 85024) landing in the same column.
// Without nodeMinSize, the tiny nodes' bars are a fraction of a pixel tall.
const data = [
  { flow: 85024, from: 'Huge', to: 'Sink' },
  { flow: 0.37, from: 'Tiny A', to: 'Sink' },
  { flow: 0.5, from: 'Tiny B', to: 'Sink' },
  { flow: 0.9, from: 'Tiny C', to: 'Sink' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data,
          nodeMinSize: 6,
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'nodeMinSize stretches the three tiny node bars (flows 0.37, 0.5, 0.9 against a Huge 85024) to a visible 6px, centered on their natural position, while the Huge node and all flows keep their exact proportions',
  options: {
    canvas: {
      height: 500,
      width: 900,
    },
    // Real font rasterization differs between the CI Linux runner and a
    // local macOS run enough to blow the 0.1% pixel tolerance on labels, so
    // draw them from the deterministic bitmap sprite sheet instead, like the
    // other fixtures with sizeable text (see `grep -l 'spriteText: true'
    // test/fixtures/*.js`).
    spriteText: true,
  },
}
