## Context

Read from `main` at 1de332e, with Chart.js 4.6.1.

Flows are Chart.js elements. `updateElements` in `src/controller.ts` hands each `Flow` its new geometry through `updateElement`, and the controller's `animations` tween it: `numbers` lists `x, y, x2, y2, height, width`, `route` is mixed by `interpolateRoute`, and `progress` reveals a flow column by column.

Nodes are not elements:

- `computeGeometry` returns `nodes: Map<string, Rect>` (`src/lib/geometry.ts`), one rectangle for every node of the plan; `update()` stores it in `this._geometry`.
- `_drawNodes()` and `_drawLabels()` are the only readers at draw time, and they read `this._geometry.nodes` on every frame. So a node is at its final place in the first frame after an update. `flow.ts`, `interaction.ts` and `labels.ts` never read a node rectangle.
- `getAutoLabelPosition` picks the side of a label from the rectangle against the middle of the chart area, every frame.
- `draw()` writes `SankeyNode.color` on the node of the plan from the animated `colorFrom` and `colorTo` of its flows, every frame; that is why nodes fade with their dataset and follow the hover of a flow.
- Browser specs read `controller._geometry.nodes` as the final rectangles (`back-flows`, `flow-node-overlap`, `geometry`, `node-min-size`, `node-padding`, `runtime-option-updates`).

How flows are matched: link `i` of the plan is row `i` of the data (`getParsedData` and `buildTopology` both map the data), and `meta.data[i]` is the element of row `i`. When the data array is replaced, Chart.js only grows or shrinks the end of `meta.data`, so after an inserted row the element `i` tweens from the old place of row `i` to the new place of another flow. Edits of the same array (`push`, `splice`, `unshift`) are already followed by Chart.js.

How routes are mixed: `interpolateRoute` (`src/flow.ts`) mixes two routes point by point when they have the same number of points and are both forward or both back; otherwise it returns the old one until the halfway point and the new one after it. A forward route is the exit of the source, an entry and an exit for every skipped column, and the entry of the target; even segments are drawn as curves and odd ones as straight runs. `interpolateRoute` has no unit test.

What Chart.js offers and does not:

- `updateElement(element, index, properties, mode)` works on any object. Modes `'reset'` and `'none'`, and any mode with `animation: false`, are a plain assignment that does not cancel a tween that is running: the tween goes on and writes its old target over the assigned value. Flows have this defect today. An update in a tweening mode retargets a running tween.
- A property tweens only when it is in the configured property list; a property that has no value yet starts at its target.
- The animator ticks every animation of the chart and redraws; it does not care where the target lives.
- The animations of an element are resolved from the dataset's options with a context; for a data element that context has `type: 'data'` and the data index. The controller's own `progress` delay and duration return nothing unless `type` is `'data'`.
- The core `transitions.resize` has duration 0, so numbers snap on a resize.
- `meta` accepts extras per chart type; `meta.dataset` holds exactly one element, and `meta.data` is tied to the data by index: parsing, hover, active elements and tooltips all go through `meta.data[index]`.

Registration today: `src/index.ts` registers the controller and `Flow`; `src/index.esm.ts` only exports. `README.md`, `src/content/docs/integration.mdx`, `src/content/docs/index.mdx` and `docs/chart-runtime.js` show or do `Chart.register(SankeyController, Flow)`, and the integration and type tests do the same.

In flight: pull request 503 changes only `package.json` and the lockfile. Pull request 496, which rewrote the label drawing, was closed without merging.

## Goals / Non-Goals

Goals:

- Nodes and their labels move with the flows when a chart is updated, and flows stay with their nodes.
- A node is a public element that later work (hover, tooltips, plugins) can build on.
- No pixel of any reference image changes, and nothing changes where nothing moves.
- No breaking change for applications that register the parts by hand.

Non-Goals:

- Hovering a node and node tooltips. They are not free: Chart.js addresses an interaction item by dataset and data index, so they need an index scheme for nodes that does not collide with the flows, the `'sankey'` interaction mode testing the node elements, hover styling that does not resolve flow options, a label and a value for a node in the tooltip, and hover options.
- A tween for a flow that becomes a back flow or stops being one. A forward flow is a filled band under an edge, a back flow a stroked lane with turns; no list of points is both. The maintainer decided to state it as a limit.
- An animation for a node that appears or disappears, or moving the colour of a node onto the element.
- An id for a flow read from the data.

## Decisions

### The node element

`NodeElement extends Element` in `src/node.ts`, id `node`. The maintainer chose a public element over a tween kept inside the controller, and the name.

- Props: `x, y, width, height` (tweened by the `numbers` list the controller already has) and `node`, the node of the plan (assigned, not animated, as `from` and `to` of a flow are).
- Options: a plain `{ borderColor, borderWidth }` object the controller builds on every update, with the border width 0 when there is none. Never the controller's own options object: Chart.js writes the keys of the given object onto the element's options.
- `draw` paints the bar with the calls `_drawNodes` makes today, and fills with `node.color`, which the controller's `draw()` writes from the flows on every frame. The element is drawn by the controller's draw, not on its own; the class says so.
- `inRange` and `getCenterPoint` over the rectangle, at the current or the final position, arrive with the piece that makes the element public. The maintainer decided that they ship now although the package has no caller for them yet.

### The label is not part of the element

The bars are drawn before the flows and the labels after them, so a label inside the element would need two draw passes. The controller keeps drawing the labels: the rectangle comes from the element (current, tweened), and the side of an automatically positioned label from `_geometry.nodes` (the final place), so that a node that crosses the middle of the chart does not flip its label in the middle of the tween.

### The elements live in `meta.nodes`

An array on the dataset meta, one element per node of the plan in plan order.

- `meta` is what interaction modes and plugins already receive, and it lives as long as the controller.
- `meta.data` cannot hold them: everything that goes by data index would break. `meta.dataset` holds one element. A private map on the controller could not be reached by a later interaction mode.
- An element keeps its identity per node key across updates. Its index is that of the node in the plan, which follows the data, so it is stable only within one update.
- It is left untyped for now (Chart.js wraps the type of a meta extension in a way that makes every member of an element optional); the docs name it in one sentence.

`_geometry.nodes` stays as the target rectangles, read once per update; the specs that read it keep working. `_drawNodes` and the rectangle lookups of the label drawing go away.

### One place decides snap or tween

`update()` works out once whether the orientation changed. If it did, the flows and the nodes are both reset; then both are updated in the mode of the update. One private method updates the nodes for a mode: it matches by key, creates the missing elements and drops the rest. A new element is assigned directly whatever the mode, so that it has a place right after `update()`.

A direct update ends a running tween: before an assignment in mode `'reset'` or `'none'`, or with animations off, the running animations of the element are cancelled. One helper, used for nodes and for flows; the maintainer decided that the flows are fixed in the same piece.

This gives, with no code of its own: first render, `update('none')` and `animation: false` are direct; a resize snaps; an orientation change snaps as the flows do; a node that appears is at its place at once and one that disappears is gone at once; hide and show are unchanged, because the colour still comes from the flows.

### Scriptable animation options get a node context

Decided by the maintainer over documenting the dataset context. The animations of a node are resolved as Chart.js resolves them for a data element, with a context made once per element: the dataset context (`chart`, `dataset`, `datasetIndex`, `mode`, `active`) plus `type: 'node'` and `node`; `mode` and `active` are set on every resolve. It has no `dataIndex`, `parsed` or `raw`, and no index of the node: the key and the column of the node are what a stagger needs, and an index would not be stable. (The `index` it inherits is that of the dataset, as in every dataset context.)

The nodes are resolved with this context from the first piece on, so that what a user's function sees for a node does not change between two releases; the piece after it only exports the types and documents them.

Animating the nodes calls the user's scriptable animation options without a data row for the first time: Chart.js reads every animation option of every animation, not only those of the properties a node has. A function that reads the row without looking at `context.type` (for example `delay: ctx => ctx.raw.flow * 10`) works today and throws once nodes are animated. The package's own defaults are guarded, and no doc or sample has such a function. The maintainer decided to accept this and to say it: the pull request and the docs of the first piece say that an animation function must check `context.type`, as the samples of Chart.js do.

`SankeyNodeScriptableContext` is a new exported type, not a variant of `SankeyScriptableContext` (which promises the row), and `SankeyNode` is exported with it because the context names it. Chart.js types an animation function with its own context type, so a user narrows with `context.type === 'node'`; the docs say so. The controller's own `progress` functions stay as they are: they do nothing unless the type is `'data'`.

The resolving is not cached, as Chart.js does not cache it for flows either: one more resolve per node and update next to one per flow.

### Flows are matched by key

Decided by the maintainer over documenting the limit. The key of a flow is its source, its target and its place among the rows with the same source and target, in data order (the maintainer chose the ordinal over an id read from the data). The rule is written once, next to the pair key the topology already builds for the lanes.

In `buildOrUpdateElements` the old elements and their keys are taken before Chart.js runs: Chart.js cuts the end of `meta.data` off when the data shrinks, and gives the elements it adds the nodes of the new plan, so afterwards neither the old elements nor their keys can be told. After Chart.js has parsed and set the length, every position gets the old element with the key of its row, or a new element. Nothing is done when the plan object is the same as before.

A new element is the controller's to place, wherever Chart.js put it: at that moment the geometry is still the one of the update before, and Chart.js resets only what it adds at the end. In `update()` a flow that is new is assigned its own geometry directly with its reveal at the start, and then only the reveal runs; so a new flow does not slide in from another flow's old place, and it is revealed also when the number of rows did not change. A new flow is not revealed when Chart.js asks not to reset new elements (a new controller, animations off).

`meta.data[i]` stays the element of row `i`, so parsing, tooltips, hover and the `'sankey'` interaction mode do not change. A flow whose row is new is revealed as Chart.js reveals an inserted row; a flow whose row is gone is gone at once. A renamed node is a new node. Elements made active from code keep pointing at their element across a data replacement, as Chart.js leaves them.

### Routes of different length are mixed

Before two forward routes are mixed, the shorter one gets the missing waypoint pairs with zero length on its own points, where the longer one has them along the columns. A route has only places, no columns, so the pairs of the two routes are lined up by their place along the columns: a pair of the shorter route is taken where the longer one has a pair at the same place (within a pixel), else a pair of zero length is put on the point before it; when as many pairs are left in the shorter as in the longer, they are taken in order. A pair is always put in between an entry and the next exit, so the alternation of curve and straight run holds. A pair of zero length draws nothing, so the first frame is the old route, the last is the new one, and in between the new straight run grows out of a point. The curve and straight alternation and the order along the columns are kept, so every frame can be drawn and hit. The `Route` type, the drawing and the hit test do not change.

### The pieces keep the reference images

No piece changes a reference image: the node element draws what `_drawNodes` drew, and every other change shows only between two updates. A builder who sees a reference image change stops.

### What the review changed

- Pull request 496 was closed, so nothing waits on it and the label reasoning no longer rests on its nudging (scope review).
- The element, the drawing from elements and the animation are one piece: an element without a caller is dead code, and drawing from elements without animating is a state the next piece rewrites (complexity review).
- The options of the element are a plain object, the colour contract is stated, and one place decides snap or tween (architecture review).
- A direct update cancels a running tween, and the tests have update-during-tween cases (rule-readers review).
- "Nodes move with their flows" did not hold for a data update that inserts or reorders rows; flows are matched by key (rule-readers review, maintainer's decision).
- "Over the same time as the flows" means the geometry tween, not the reveal (architecture review).
- The list of places that show the registration is complete (rule-readers review).
- Registering an element nothing looks up was questioned by two reviews; the maintainer decided to register it.
- A second review of the parts added after the first one: the old flow elements are taken before Chart.js cuts them off; new flows are placed and revealed by the controller; the nodes get their context in the first piece; the rule that lines up the waypoint pairs is written down; the table says what a piece needs and what it only shares a file with; unguarded animation functions are named as a risk.

## Risks / Trade-offs

- `meta.nodes` is a public shape before anything outside the controller uses it, and `inRange` and `getCenterPoint` ship without a caller in the package.
- Registration is formal: the controller never looks the element up, so replacing the registered element has no effect.
- Parallel flows between the same two nodes are matched by their order; reordered among themselves they swap identities.
- A flow that becomes a back flow or stops being one still switches shape halfway and is not attached to its nodes while they move.
- An element per node adds objects, an animation target and an animation resolve per node and update; on the densest fixture that is 78 nodes next to 584 flows. Not measured.
- Cancelling running tweens reads `$animations` of an element, and resolving the animations of a node calls methods of the chart's config that Chart.js does not type or document.
- A scriptable animation option that reads the data row without checking `context.type` throws once nodes are animated (see the node context).
- A resize during a tween is retargeted by Chart.js, not snapped, for nodes as for flows today.
- Known and not changed here: when the data becomes empty, the controller keeps its last plan and geometry, so the nodes stay drawn; with node elements they stay the same way.

## Pieces

| # | Builds | Files | Test that fails without it | Size | Waits on | Issues |
|---|---|---|---|---|---|---|
| P1 | Nodes and labels move with the flows: `NodeElement` (draw only), `meta.nodes` matched by key and animated with a node context, one helper that ends a running tween on a direct update (nodes and flows), bars and labels drawn from the elements; `_drawNodes` removed. Commit type `fix`. | `src/node.ts`, `src/types.ts`, `src/controller.ts`, `test/specs/node-animation.spec.js`, `src/content/docs/usage.mdx` | Browser spec, see tasks 1.1 | ~370 (110 source) | nothing | none |
| P2 | Forward routes of different length glide; the limit for back flows is documented. Commit type `fix`. | `src/flow.ts`, `src/flow.test.ts`, `src/content/docs/usage.mdx` | Unit tests of `interpolateRoute`, see tasks 2.1 | ~115 (15 source) | nothing | none |
| P3 | The types of the node context are public: `SankeyNodeScriptableContext` and `SankeyNode` exported, typed and documented. Commit type `feat`. | `src/types.ts`, `src/index.ts`, `src/index.esm.ts`, `test/types/options.ts`, `src/content/docs/usage.mdx` | Type tests, see tasks 3.1 | ~60 | P1 | none |
| P4 | Flows matched by key across a data replacement, new flows placed and revealed by the controller; the limit for parallel flows is documented. Commit type `fix`. | `src/controller.ts`, `src/lib/topology.ts`, `test/specs/flow-matching.spec.js`, `src/content/docs/usage.mdx` | Browser spec, see tasks 4.1 | ~230 (40 source) | P1 | none |
| P5 | The node element is public: hit test, export from both entries, registration, every place that shows the registration. Commit type `feat`. | `src/node.ts`, `src/node.test.ts`, `src/index.ts`, `src/index.esm.ts`, `docs/chart-runtime.js`, `README.md`, `src/content/docs/integration.mdx`, `src/content/docs/index.mdx`, `test/integration/*`, `test/specs/fixtures.spec.js`, `test/types/options.ts` | Unit, integration and type tests, see tasks 5.1 | ~130 | P1; shares `src/index.ts`, `src/index.esm.ts` and `test/types/options.ts` with P3 | none |

P1 and P2 can be built now, in parallel. After P1, P3, P4 and P5 need nothing from each other: P4 can be built in parallel with the other two, and of P3 and P5, which change the same three files by hand, the second one waits for the first. The pieces add sentences to different sections of `usage.mdx`; a piece that lands after another rebases.

## Contracts

- P1 → P3, P4, P5: `NodeElement` with the props `x, y, width, height, node`, the options `borderColor, borderWidth` and `draw(ctx)`. `meta.nodes` is an array of `NodeElement`, one per node of the plan in plan order, the same instance for the same key across updates. The animations of a node are resolved with a context of `type: 'node'` that holds the node. One private method of the controller updates the nodes for a mode, and one helper ends the running tweens of an element.
- P3 → P5: `SankeyNode` and `SankeyNodeScriptableContext` are exported from both entries.

## Open Questions

None.
