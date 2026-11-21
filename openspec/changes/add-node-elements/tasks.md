## 1. P1: nodes and labels move with the flows

- [ ] 1.1 Browser spec `test/specs/node-animation.spec.js` that fails:
  - one element per node in `meta.nodes`, in plan order, with the rectangle of the geometry; the same element for the same key after an update; the element of a removed node is gone
  - after an update that changes `nodeAlign`, with animations on: the elements are still at the old rectangles, their final values are those of the geometry, the animation is running, and the label side is the final one
  - direct: first render, `'none'`, `animation: false`, a resize, a new node, an orientation change
  - during a tween: a second `nodeAlign` change, an orientation change and an update with `'none'` each end at the rectangles of the last update, for the nodes and for the flows
- [ ] 1.2 `NodeElement` in `src/node.ts` with `draw`, and its props and options in `src/types.ts`
- [ ] 1.3 The controller keeps `meta.nodes`, matched by key, and updates them in `update()` with the sequence of the flows
- [ ] 1.4 One helper ends the running tweens of an element before a direct update, for nodes and for flows
- [ ] 1.5 The bars and the labels are drawn from the elements, the label side from the geometry; `_drawNodes` is removed
- [ ] 1.6 `usage.mdx`: what moves when a chart is updated, and `meta.nodes` in one sentence
- [ ] 1.7 Every existing test passes and no reference image changes

## 2. P2: routes of different length glide

- [ ] 2.1 Unit tests of `interpolateRoute` in `src/flow.test.ts` that fail, for a route of two points and one of four: halfway the result has four points and is neither argument; at the start its points are those of the shorter route with a pair of zero length; the points are in order along the columns at a quarter, a half and three quarters; one waypoint to two keeps the place of the shared one when the columns do not move; long to short mirrors it; a flow given the halfway route is hit on its band. And one that holds already: forward to back returns one of the two
- [ ] 2.2 The shorter of two forward routes is padded before they are mixed
- [ ] 2.3 `usage.mdx`: a flow that becomes a back flow, or stops being one, changes shape halfway through the animation

## 3. P3: scriptable animation options see a node

- [ ] 3.1 Tests that fail: in `test/specs/node-animation.spec.js`, a scriptable delay is called once per node with `type: 'node'`, the node, the mode and the dataset index and no data index; a delay from the column of the node gives nodes of different columns different starts; a function that reads the data index is still called with it for the flows. In `test/types/options.ts`: `SankeyNodeScriptableContext` has `node` and no `dataIndex`, and both types are exported
- [ ] 3.2 The context of a node and the resolving of its animations with it
- [ ] 3.3 `SankeyNodeScriptableContext` and `SankeyNode` exported from both entries
- [ ] 3.4 `usage.mdx`: the context of a node, and that a function narrows with `context.type`

## 4. P4: flows are matched by key

- [ ] 4.1 Browser spec `test/specs/flow-matching.spec.js` that fails: after the data is replaced by the same rows with one inserted in front, every kept flow is the same element, its geometry right after the update is its own old geometry, the new one is at the start of its reveal, and halfway the ends of every kept flow lie on the elements of its nodes. Rows reordered; a row removed; parallel rows matched in order. And cases that hold already: an edit of the same array, and unchanged data
- [ ] 4.2 The elements of `meta.data` are re-matched by key in `buildOrUpdateElements`
- [ ] 4.3 `usage.mdx`: how flows are matched across a data update, and the limit for parallel flows

## 5. P5: the node element is public

- [ ] 5.1 Tests that fail: unit tests of `inRange` and `getCenterPoint` at the current and at the final position, and of `draw` (border, no border, the colour of the node); the registry has the element after the registering entry; the ESM entry exports it; an integration test draws a chart with only the controller and the flow element registered; the type test names the export
- [ ] 5.2 `inRange` and `getCenterPoint`
- [ ] 5.3 The export from both entries and the registration, also in `docs/chart-runtime.js`
- [ ] 5.4 `README.md`, `integration.mdx` and `index.mdx` name the element among what an application registers, and say that a chart works without it
- [ ] 5.5 Archive the change: `openspec archive add-node-elements --yes`
