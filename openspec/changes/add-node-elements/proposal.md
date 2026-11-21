## Why

When the layout of a live chart changes (new data, another `nodeAlign`, another `nodePadding`), the flows glide to their new places but the nodes and their labels jump there at once, so for the length of the animation the flows hang loose from their nodes. Nodes are not Chart.js elements: the controller paints them from the finished geometry on every frame.

## What Changes

- A node becomes a Chart.js element, `NodeElement` (id `node`): it draws the bar of the node and can say whether a point is on it. The controller keeps one per node in `meta.nodes`, in the order of the nodes, and matches them by node key from one update to the next.
- The bars of the nodes, and the labels with them, move and resize over the same time as the flows when a chart is updated.
- `NodeElement` is exported from both entries and registered by the entry that registers the rest.
- Nothing changes where nothing moves: the first render, a resize, a change of orientation, a chart without animations and the reference images are as before.

No breaking change: a chart still works when only the controller and the flow element are registered.

Not part of this change: hovering a node and node tooltips. They need more than the element (see `design.md`).

## Capabilities

### New Capabilities

- `node-animation`: how the nodes and their labels move when a chart is updated, and what the node element is.

### Modified Capabilities

None.

## Impact

- `src/node.ts` (new), `src/types.ts`: the element and its types.
- `src/controller.ts`: keeps the elements, updates them with the flows, draws bars and labels from them; `_drawNodes` goes away.
- `src/index.ts`, `src/index.esm.ts`, `README.md`, `src/content/docs/integration.mdx`: the export, the registration and what the docs tell ESM users to register.
- Tests: unit tests of the element, browser specs for the elements and their animation, the integration and type tests of the entries. No reference image changes.
- Open pull request 496 rewrites the node label drawing in `src/controller.ts`; the pieces that change that file wait for it.
