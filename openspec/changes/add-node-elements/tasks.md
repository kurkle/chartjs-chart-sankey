## 1. P1: nodes and labels move with the flows

- [ ] 1.1 Browser spec `test/specs/node-animation.spec.js` that fails:
  - one element per node in `meta.nodes`, in plan order, with the rectangle of the geometry; the same element for the same key after an update; the element of a removed node is gone
  - after an update that changes `nodeAlign`, with animations on: the elements are still at the old rectangles, their final values are those of the geometry, the animation is running, and the label side is the final one
  - direct: first render, `'none'`, `animation: false`, a resize, a new node, an orientation change
  - during a tween: a second `nodeAlign` change, an orientation change and an update with `'none'` each end at the rectangles of the last update, for the nodes and for the flows
  - a scriptable delay is called once per node with `type: 'node'`, the node, the mode and the dataset index and no data index; a delay from the column of the node gives nodes of different columns different starts; a function that reads the data index is still called with it for the flows
- [ ] 1.2 `NodeElement` in `src/node.ts` with `draw`, and its props and options in `src/types.ts`
- [ ] 1.3 The controller keeps `meta.nodes`, matched by key, and updates them in `update()` with the sequence of the flows; their animations are resolved with a context of `type: 'node'` that holds the node, never with the context of a data row
- [ ] 1.4 One helper ends the running tweens of an element before a direct update, for nodes and for flows
- [ ] 1.5 The bars and the labels are drawn from the elements, the label side from the geometry; `_drawNodes` is removed
- [ ] 1.6 `usage.mdx`: what moves when a chart is updated, `meta.nodes` in one sentence, and that a scriptable animation option is now called for nodes too and must check `context.type`; the pull request says the same
- [ ] 1.7 Every existing test passes and no reference image changes

## 2. P2: routes of different length glide

- [ ] 2.1 Unit tests of `interpolateRoute` in `src/flow.test.ts` that fail, for a route of two points and one of four: halfway the result has four points and is neither argument; at the start its points are those of the shorter route with a pair of zero length; the points are in order along the columns at a quarter, a half and three quarters; one waypoint to two keeps the place of the shared one when the columns do not move; long to short mirrors it; a flow given the halfway route is hit on its band. And one that holds already: forward to back returns one of the two
- [ ] 2.2 The shorter of two forward routes is padded before they are mixed, its pairs lined up with those of the longer one by their place along the columns
- [ ] 2.3 `usage.mdx`: a flow that becomes a back flow, or stops being one, changes shape halfway through the animation

## 3. P3: the types of the node context are public

- [ ] 3.1 Type tests in `test/types/options.ts` that fail: `SankeyNodeScriptableContext` has `node` and `type: 'node'` and no `dataIndex`, `parsed` or `raw`; both types are exported from the package
- [ ] 3.2 `SankeyNodeScriptableContext` in `src/types.ts`; it and `SankeyNode` exported from both entries
- [ ] 3.3 `usage.mdx`: what the context of a node holds, and how a function narrows with `context.type`

## 4. P4: flows are matched by key

- [ ] 4.1 Browser spec `test/specs/flow-matching.spec.js` that fails: after the data is replaced by the same rows with one inserted in front, every kept flow is the same element, its geometry right after the update is its own old geometry, the new one is at its own final place at the start of its reveal, and halfway the ends of every kept flow lie on the elements of its nodes. Rows reordered; the first row removed (the kept flows are the same elements although Chart.js cut the end off); one row replaced by a new one with the number of rows unchanged (the new flow is revealed); parallel rows matched in order. And cases that hold already: an edit of the same array, and unchanged data
- [ ] 4.2 The key of a flow, written next to the pair key in `src/lib/topology.ts`
- [ ] 4.3 The old elements and their keys are taken before Chart.js resyncs, and the elements of `meta.data` are re-matched after it in `buildOrUpdateElements`
- [ ] 4.4 A new flow is placed at its own geometry and revealed by the controller in `update()`, unless new elements are not to be reset
- [ ] 4.5 `usage.mdx`: how flows are matched across a data update, and the limit for parallel flows

## 5. P5: the node element is public

- [ ] 5.1 Tests that fail: unit tests of `inRange` and `getCenterPoint` at the current and at the final position, and of `draw` (border, no border, the colour of the node); the registry has the element after the registering entry; the ESM entry exports it; an integration test draws a chart with only the controller and the flow element registered; the type test names the export
- [ ] 5.2 `inRange` and `getCenterPoint`
- [ ] 5.3 The export from both entries and the registration, also in `docs/chart-runtime.js`
- [ ] 5.4 `README.md`, `integration.mdx` and `index.mdx` name the element among what an application registers, and say that a chart works without it

## 6. P6: node tooltips

- [ ] 6.1 Browser spec `test/specs/node-tooltip.spec.js` that fails. The pointer goes through `canvas.dispatchEvent(new MouseEvent('mousemove', …))` and one animation frame, because `setActiveElements` cannot reach a node. Cases:
  - at the centre of a node bar: `tooltip.dataPoints[0].element` is the node's element in `meta.nodes`, its `dataIndex` is at least the number of rows, the body is `['B: 30']`, the title is empty, and the caret is at `getCenterPoint`
  - with `labels`: the line uses the label
  - node, then one of its flows, then the node: the lines change each time
  - where a flow meets its node: the flow is found
  - a scriptable `colorFrom` that reads `data[dataIndex]`: nothing throws, and `labelColors[0].backgroundColor` is the colour of the node
  - a user `label` callback that checks `context.element instanceof NodeElement`
  - `onClick` gets the node item; `chart.getActiveElements()` holds it while hovered
  - `mouseout` hides the tooltip
  - `mode: 'nearest'`, `intersect: false` and a chart with another type mixed in find no node
  - during a tween the tooltip is at the bar as drawn
  - and a unit test of `tooltipPosition` in `src/node.test.ts`; `hit.spec.js` and `thin-hit.spec.js` are not edited
- [ ] 6.2 `NodeElement.tooltipPosition` is `getCenterPoint`
- [ ] 6.3 The `'sankey'` mode tests `meta.nodes` when no flow is hit, with index `meta.data.length + i`
- [ ] 6.4 The controller's `getLabelAndValue`, `getStyle`, `setHoverStyle` and `removeHoverStyle` for node items, going by the element where it is given, and the default `label` callback for a node
- [ ] 6.5 `NodeElement` in the globals of `docs/chart-runtime.js`; the tooltip callbacks of `refugee-hosting-2025.md` and `us-energy-2023.md` handle nodes
- [ ] 6.6 `usage.mdx`: nodes are found where no flow is; the default tooltip of a node; the rule `context.element instanceof NodeElement`; that callbacks, filters and `onHover`/`onClick` now get node items; the limits (no node from `setActiveElements`, hidden outside the chart area). The pull request says the same under "Behaviour change" and links #55 as related
- [ ] 6.7 Every existing test passes and no reference image changes

## 7. P7: hovering a node highlights its flows

- [ ] 7.1 Browser spec `test/specs/node-hover.spec.js` that fails, with `animation: false`:
  - hovering a node: every flow of the node is active and has its hover colours, no other flow is, and the colour of the node is a hover colour
  - the mouse out: everything is back to its colours
  - from a node onto one of its flows: only that flow is active
  - from a flow onto its node: every flow of the node is active
  - `chart.update()` while a node is hovered: the highlight stays
  - a flow from a node to itself is set once
- [ ] 7.2 `setHoverStyle` and `removeHoverStyle` of a node set and remove the hover style of its flows, each once
- [ ] 7.3 `usage.mdx`: hovering a node highlights its flows and, through them, the bars at their other ends
- [ ] 7.4 Archive the change: `openspec archive add-node-elements --yes`
