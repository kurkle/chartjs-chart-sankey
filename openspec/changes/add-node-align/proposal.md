## Why

The nodes of a column are always moved to where their flows meet, so a chart cannot be drawn with its columns lined up along one edge, the way most Sankey diagrams from other tools look. `nodePaddingMode: 'even'` is the only control over the placement across the columns, and it only switches the per-node alignment off inside a column.

## What Changes

- A new dataset option `nodeAlign` with the values `'auto'` (the default: what is drawn today), `'start'`, `'end'` and a fourth value, working name `'edges'`.
  - `'start'` and `'end'` pack every column at the start or the end of the cross axis with the requested gaps; the nodes are not moved towards their flows.
  - `'edges'` puts the first and the last slot of a column at its two edges and places the ones between them as `'auto'` does.
- With `'start'` and `'end'` the drawing as a whole sits at that edge when the scale leaves room on the cross axis; today it is always centred.
- Flows that skip columns are made level with every value, as they are today.
- `nodePaddingMode` is marked deprecated. It keeps working, and it has an effect only while `nodeAlign` is `'auto'`.

No breaking change.

## Capabilities

### New Capabilities

- `node-alignment`: where the nodes of a column sit along the cross axis, and where the drawing sits when it does not fill that axis.

### Modified Capabilities

None. The repository has no written specs yet; `nodePaddingMode` is described only in the user docs.

## Impact

- `src/lib/geometry.ts`: the placement of the slots and the shift of the whole drawing.
- `src/types.ts`, `src/controller.ts`: the option, its default and how it reaches the geometry.
- Docs: `usage.mdx`, a new sample page, the node padding sample.
- Tests: unit tests of the geometry, new browser fixtures with image baselines, the runtime option spec, the type tests.
- Open pull request #496 changes `src/controller.ts` and `src/content/docs/usage.mdx`; the pieces that touch those files wait for it.
