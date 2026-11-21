## Context

Read from `main` at dbb4ebc, with Chart.js 4.6.1.

Flows are Chart.js elements. `updateElements` in `src/controller.ts` hands each `Flow` its new geometry through `updateElement`, and the controller's `animations` tween it: `numbers` lists `x, y, x2, y2, height, width`, `route` is interpolated, and `progress` reveals a flow.

Nodes are not elements:

- `computeGeometry` returns `nodes: Map<string, Rect>` (`src/lib/geometry.ts`); `update()` stores it in `this._geometry`.
- `_drawNodes()` and `_drawLabels()` are the only readers at draw time, and they read `this._geometry.nodes` on every frame. So a node is at its final place in the first frame after an update. `flow.ts`, `interaction.ts` and `labels.ts` never read a node rectangle.
- `getAutoLabelPosition` picks the side of a label from the rectangle against the middle of the chart area, every frame.
- `draw()` writes `SankeyNode.color` on the node of the plan from the animated `colorFrom` and `colorTo` of its flows, every frame; that is why nodes fade with their dataset and follow the hover of a flow.
- Browser specs read `controller._geometry.nodes` as the final rectangles (`back-flows.spec.js`, `flow-node-overlap.spec.js`, `geometry.spec.js`).

What Chart.js offers for an element outside `meta.data`:

- `updateElement(element, index, properties, mode)` works on any object, and with `index` undefined it resolves the animations in the context of the dataset, as Chart.js does for its own dataset element. Modes `'reset'` and `'none'` assign directly. A property tweens only when it is in the configured property list; a property that has no value yet starts at its target.
- The animator ticks every animation of the chart and redraws; it does not care where the target lives.
- `Element.getProps(props, true)` gives the target of a running tween.
- The core `transitions.resize` has duration 0, so numbers snap on a resize.
- `meta` accepts extras per chart type (`metaExtensions`); `meta.dataset` holds exactly one element, and `meta.data` is tied to the data by index: parsing, hover, active elements and tooltips all go through `meta.data[index]`.

Registration today: `src/index.ts` registers the controller and `Flow`; `src/index.esm.ts` only exports. `README.md` and `src/content/docs/integration.mdx` tell ESM users to call `Chart.register(SankeyController, Flow)`, and the integration and type tests do exactly that.

In flight: pull request 496 replaces `_drawLabels` with a measure step and a paint step in which the labels of a column are placed together and nudged apart, so a label can no longer be placed by its node alone. It changes `src/controller.ts`, `src/labels.ts`, `src/labels.test.ts`, `src/content/docs/usage.mdx` and label fixtures. Pull request 503 changes only `package.json` and the lockfile.

## Goals / Non-Goals

Goals:

- Nodes and their labels move with the flows when a chart is updated.
- A node is a public element that later work (hover, tooltips, plugins) can build on.
- No pixel of any reference image changes, and nothing changes where nothing moves.
- No breaking change for applications that register the parts by hand.

Non-Goals:

- Hovering a node and node tooltips. They are not free: Chart.js addresses an interaction item by dataset and data index, so they need an index scheme for nodes that does not collide with the flows, the `'sankey'` interaction mode testing the node elements, hover styling that does not resolve flow options, a label and a value for a node in the tooltip, and hover options.
- New animation options, or an animation for a node that appears or disappears.
- Moving the colour of a node onto the element.

## Decisions

### The element

`NodeElement extends Element` in `src/node.ts`, id `node`.

- Props: `x, y, width, height` (tweened by the `numbers` list the controller already has) and `node`, the node of the plan (assigned, not animated, as `from` and `to` of a flow are).
- Options: `borderColor` and `borderWidth`, handed over by the controller from the dataset options. No defaults of its own and no new option.
- `draw` paints the bar with the calls `_drawNodes` makes today: the stroke when there is a border, then the fill with the colour of the node.
- `inRange` and `getCenterPoint` over the rectangle, at the current or the final position. Nothing else: no `tooltipPosition`, no `getRange`.

The maintainer chose a public element over a tween kept inside the controller.

### The label is not part of the element

The bars are drawn before the flows and the labels after them, and once pull request 496 has landed the labels of a column are placed together. A label inside the element would need two draw passes and would rule the nudging out. The controller keeps drawing the labels and reads the current rectangle of each element.

The side of an automatically positioned label is taken from the final place of its node, so that a node that crosses the middle of the chart does not flip its label in the middle of the tween.

### The elements live in `meta.nodes`

An array in the order of the nodes of the plan, on the dataset meta.

- `meta` is what interaction modes and plugins already receive, and it lives as long as the controller.
- `meta.data` cannot hold them: everything that goes by data index would break.
- `meta.dataset` holds one element.
- A private map on the controller would not be public, and a later interaction mode could not reach it.
- An array, not a map, gives a later interaction item its index.

`_geometry.nodes` stays as the target rectangles, read once per update; the specs that read it keep working. `_drawNodes` and the rectangle lookups of the label drawing go away.

### Matching and updating

In `update()`, after the geometry: the old elements are indexed by node key; every node of the plan that has a rectangle reuses its element or gets a new one; `updateElement(element, undefined, { node, options, ...rect }, mode)` hands over the target. The mode is `'reset'` for a new element and when the orientation changed, else the mode of the update. Elements whose key is gone are dropped.

This gives, with no code of its own:

- first render, `update('none')` and `animation: false`: direct;
- resize: snap (the core resize transition);
- orientation change: snap, as the flows do;
- a node that appears: at its place at once; a node that disappears: gone at once;
- hide and show: unchanged, because the colour still comes from the flows.

The animations are resolved in the context of the dataset, so an animation option of the user that is a function of the data index does not get one for a node.

### No registry lookup

The controller imports the class, as it imports `Flow`, and creates the elements itself. The registering entry registers it and both entries export it, but a chart does not depend on the registration, so an application that registered `SankeyController, Flow` keeps working. Looking the element up in the registry, as Chart.js does for `dataElementType`, would break every such application and need a major release.

### The pieces keep the reference images

The piece that moves the drawing onto the elements assigns them directly, so it is pixel-identical; the animation is switched on by a later, small piece. A builder who sees a reference image change in any piece stops.

## Risks / Trade-offs

- `meta.nodes` is a public shape before anything outside the controller uses it. It is left untyped (`metaExtensions` wraps its type in `DeepPartial`, which mangles an array of elements) until node hover fixes the contract.
- `inRange` and `getCenterPoint` ship without a caller in the package.
- Scriptable animation options of the user see the dataset context for nodes; a delay computed from `dataIndex` is not a number there. The docs say so.
- Pull request 496 rewrites the label drawing this change reads; the pieces that touch `src/controller.ts` are designed from `main` and their builder confirms the readers again after that pull request has landed.
- An element per node adds objects and one more animation target per node; on the densest fixture that is 78 nodes next to 584 flows.

## Pieces

| # | Builds | Files | Test that fails without it | Size | Waits on | Issues |
|---|---|---|---|---|---|---|
| P1 | `NodeElement`: draws the bar, hit test, centre. Not used, exported or registered yet. Commit type `refactor`. | `src/node.ts`, `src/node.test.ts`, `src/types.ts` | Unit tests: draws its rectangle with the border and the colour of its node; no stroke without a border; hit test at the current and at the final position | ~150 (45 source) | nothing | none |
| P2 | The controller keeps `meta.nodes`, matched by key and assigned directly, and draws the bars and the labels from them; `_drawNodes` goes away. Nothing visible changes. Commit type `refactor`. | `src/controller.ts`, `test/specs/node-elements.spec.js` | Browser spec: one element per node with the rectangle of the geometry; the same element for the same key after a data update; the element of a removed node is gone. Every fixture image unchanged. | ~130 | P1, #496 | none |
| P3 | `NodeElement` exported from both entries and registered by the registering one; the docs name it. Commit type `feat`. | `src/index.ts`, `src/index.esm.ts`, `README.md`, `src/content/docs/integration.mdx`, `test/integration/*`, `src/package.test.ts`, `test/types/options.ts` | The registry has `node` after the registering entry; the ESM entry exports it; a chart still draws with only the controller and the flow element registered | ~90 | P2 | none |
| P4 | The nodes are updated with the mode of the update, and the label side comes from the final place: nodes and labels move with the flows. Commit type `fix`. | `src/controller.ts`, `test/specs/node-animation.spec.js`, `test/specs/orientation-change.spec.js`, `src/content/docs/usage.mdx` | Browser spec: after an update that changes `nodeAlign` the elements are still at the old rectangles, their final values are those of the geometry, and the animation is running; snap with `'none'`, with `animation: false`, on a resize, on an orientation change and for a new node; the label side does not change during a tween | ~220 | P2, #496 | none |

P1 can be built now. P3 and P4 do not depend on each other and can be built in parallel once P2 has landed.

## Contracts

- P1 → P2: `NodeElement` with the props `x, y, width, height, node`, the options `borderColor, borderWidth`, `draw(ctx)`, `inRange(x, y, useFinalPosition)` and `getCenterPoint(useFinalPosition)`.
- P2 → P3, P4: `meta.nodes` is an array of `NodeElement` in the order of the nodes of the plan, one per drawn node, the same instance for the same key across updates; the bars and the labels are drawn from the current values of the elements.

## Open Questions

1. (P1) The name and the id: `NodeElement` / `node`, or `SankeyNodeElement` / `sankeyNode`. Proposed: `NodeElement` / `node`.
2. (P2, P3) Whether a chart may depend on the registration of the element. Proposed: no, see "No registry lookup".
3. (P1) Whether the hit test ships now, without a caller. Proposed: yes, and nothing more.
4. (P3) Whether `meta.nodes` is typed now. Proposed: no.
5. (P4) A node that appears or disappears: at once, or fading. Proposed: at once.
6. (P4) The first render: nodes in place at once as today, or revealed with the flows. Proposed: as today.
7. (P4) A change of orientation: snap like the flows, or tween. Proposed: snap.
8. (P4) Scriptable animation options of the user for nodes: documented as seeing the dataset context, or a context of their own for nodes. Proposed: documented.
9. (P4) The commit type of the piece that makes the nodes move: `fix` or `feat`. Proposed: `fix`.
