## Why

When the layout of a live chart changes (new data, another `nodeAlign`, another `nodePadding`), the flows glide to their new places but the nodes and their labels jump there at once, so for the length of the animation the flows hang loose from their nodes. Nodes are not Chart.js elements: the controller paints them from the finished geometry on every frame. Flows have gaps of their own: after rows are inserted or reordered a flow glides from another flow's old place, a flow that starts or stops skipping a column switches shape halfway, and an update without animation during a tween ends at the place of the update before it.

## What Changes

- A node becomes a Chart.js element, `NodeElement` (id `node`). The controller keeps one per node in `meta.nodes`, in the order of the nodes, and matches them by node key from one update to the next.
- The bars of the nodes, and the labels with them, move and resize over the same time as the ends of the flows when a chart is updated.
- An update without animation ends a tween that is running, for nodes and for flows.
- A forward flow that gains or loses a skipped column glides to its new shape.
- Flows are matched across updates by their source and target, not by their row, so a flow stays with its nodes when rows are inserted, removed or reordered.
- Scriptable animation options are called for a node with a context of its own (`type: 'node'`, `node`); its type `SankeyNodeScriptableContext` and `SankeyNode` are exported.
- `NodeElement` is exported from both entries, registered by the entry that registers the rest, and can say whether a point is on it.
- A node shows a tooltip with its label and its total where the pointer is on its bar and no flow is hit. Tooltip callbacks, filters and `onHover`/`onClick` also receive node items, told apart with `context.element instanceof NodeElement`; the samples' callbacks do so.
- Hovering a node highlights its flows in their hover colours.
- Nothing changes where nothing moves: the first render, a resize, a change of orientation and the reference images are as before.

No API is removed, and a chart still works when only the controller and the flow element are registered. Behaviour change: a tooltip callback, filter or `onHover`/`onClick` handler that assumes every item is a data row (for example reads `context.raw.from`) throws on a node item until it checks the item.

Not part of this change: hover options of a node's own, activating a node from code, a node's total in its static label (#55), and a tween for a flow that becomes a back flow or stops being one.

## Capabilities

### New Capabilities

- `update-animation`: how nodes, their labels and flows move when a chart is updated, and what the node element is.
- `node-interaction`: what pointing at a node gives: its tooltip, the items callbacks receive, and the flows it highlights.

### Modified Capabilities

None.

## Impact

- `src/node.ts` (new), `src/types.ts`: the element, its types, the node context.
- `src/controller.ts`: keeps the node elements, updates them with the flows, draws bars and labels from them, matches the flows by key; `_drawNodes` goes away.
- `src/flow.ts`: routes of different length are mixed.
- `src/index.ts`, `src/index.esm.ts`, `docs/chart-runtime.js`, `README.md`, `src/content/docs/integration.mdx`, `src/content/docs/index.mdx`, `src/content/docs/usage.mdx`: the exports, the registration and the docs.
- `src/interaction.ts`: the `'sankey'` mode finds a node where no flow is hit.
- `src/content/docs/samples/refugee-hosting-2025.md`, `src/content/docs/samples/us-energy-2023.md`: their tooltip callbacks handle nodes.
- Tests: unit tests, new browser specs, the integration and type tests of the entries. No reference image changes.
