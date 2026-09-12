const data = [
  { flow: 10, from: 'S1', to: 'M1' },
  { flow: 6, from: 'S2', to: 'M1' },
  { flow: 14, from: 'S3', to: 'M2' },
  { flow: 4, from: 'S4', to: 'M2' },
  { flow: 10, from: 'M1', to: 'T1' },
  { flow: 6, from: 'M1', to: 'T2' },
  { flow: 4, from: 'M2', to: 'T2' },
  { flow: 14, from: 'M2', to: 'T3' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data,
          // Four sources feeding two middle nodes is what makes the 'auto'
          // cross-column effect visible: with nodePaddingMode left at the
          // default 'auto', M2 (which only has one real neighbor, M1, in
          // its own column) still has to clear every node stacked above it
          // in column 0, so it ends up with extra "virtual" padding well
          // beyond the requested 20px gap -- and that inflation carries
          // through to the T2/T3 column too. nodePaddingMode: 'even' skips
          // that cross-column requirement entirely: every gap in every
          // column is exactly max(prev.after, next.before), so M2 sits
          // right below M1 with a regular 20px gap, like every other pair.
          nodePadding: 20,
          nodePaddingMode: 'even',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    "nodePaddingMode: 'even' lays out each column's nodes back-to-back with a regular gap, instead of 'auto' inflating a node's gap to clear nodes stacked above it in earlier columns",
  options: {
    canvas: {
      height: 400,
      width: 700,
    },
    // Node labels are incidental to what this fixture measures (gaps
    // between nodes in a column), not the point of comparison. Draw them
    // from the deterministic bitmap sprite sheet so font rasterization
    // differences between the CI Linux runner and a local macOS run don't
    // blow the 0.1% pixel tolerance (see `grep -l 'spriteText: true'
    // test/fixtures/*.js`).
    spriteText: true,
  },
}
