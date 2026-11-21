## Context

Read from `main` at cc78618.

Where a slot (a node, or the waypoint of a flow that skips the column) sits on the cross axis is decided in `src/lib/geometry.ts`:

- `placeSlots` packs every column with its gaps and centres it in the room of the column (`base[c] + max(0, (rooms[c] - total) / 2)`), where `base` is the depth of the back flow lanes before the content and `rooms` is the axis less the lanes on both sides, per column. Then `PASSES` alternating passes call `fitColumn` with the wishes of the flows; its `rigid` flag moves a column as one block. Then, unless `rigid`, `levelSkippingFlows` (`src/lib/straighten.ts`) ties the waypoints of the flows that skip columns to one level.
- `computeGeometry` lays the lanes around the content (`placeLoops`), then shifts the whole drawing by `round((wExtent - high - low) / 2)`, so that what the scale leaves over is shared before and after it, and lays the lanes again. `low` and `high` include the outer edges of the lanes.
- Nothing in the placement knows the orientation: it works in `(u, w)` and `rect()` maps to x/y.

Readers of the one existing control, `nodePaddingMode`:

- `src/types.ts:102` (`'auto' | 'even'`), `src/controller.ts:166` (default) and `:317` (passed on as `paddingMode`), `src/lib/geometry.ts:49` (`GeometryInput.paddingMode`) and `:487` (`rigid`).
- Docs that state the rule: `src/content/docs/usage.mdx:133` (a larger gap "in `auto` mode"), `:156` and `:166` (the Node Padding Mode section), `:230` (waypoints are not held level with `'even'`), the option table at `:83`, and `src/content/docs/samples/node-padding.md:53` (with measured gaps).
- Tests: `src/lib/geometry.test.ts`, `test/specs/runtime-option-updates.spec.js`, `test/types/options.ts`, `test/fixtures/node-padding-even.js`.

`GeometryInput` is not exported from the package. `flow.ts`, `labels.ts` and `interaction.ts` read only the finished rectangles.

What `nodePaddingMode: 'even'` is for: with `'auto'` every node is moved to its flows on its own, which can open a gap wider than the requested one between two nodes of a column. `'even'` keeps the requested gaps by moving the column as one block. It is a way around a side effect of the per-node alignment, not a placement of its own, and it also switches the levelling of skipping flows off.

In flight: pull request #496 changes `src/controller.ts`, `src/content/docs/usage.mdx`, `src/labels.ts`, `src/labels.test.ts` and label fixtures. #503 changes only `package.json` and the lockfile.

## Goals / Non-Goals

Goals:

- Columns packed at one edge of the cross axis, or pinned to both, by one option.
- The default drawing does not change by a pixel.
- `nodePaddingMode` stops growing: it is deprecated and gains no new combination.

Non-Goals:

- Removing `nodePaddingMode`; that is for 1.0.
- Alignment along the column axis (which column a node is in); `column` and `modeX` own that. The docs say so, because `nodeAlign` in d3-sankey means that.
- A value that packs the columns in the centre without aligning them, or one that moves a column as a block.
- Changing the scale: a column keeps the room `solve` budgeted for it.

## Decisions

### One enum, resolved once

`nodeAlign?: 'auto' | 'start' | 'end' | 'edges'` on the dataset options, default `'auto'`, not scriptable, resolved like `nodePaddingMode`. The controller passes it to `computeGeometry` as `align`, mapping anything else to `'auto'`.

`computeGeometry` resolves `align` and `paddingMode` once into what the placement needs, and `placeSlots` and the shift of the drawing read that, so the enum is compared in one place:

| Value | `lead`: share of the free room before the column, and of the spare room before the drawing | `move`: slots the passes move | `rigid` | Levelling |
|---|---|---|---|---|
| `auto` | 0.5 | all | from `nodePaddingMode` | unless `rigid` |
| `start` | 0 | none | no | yes |
| `end` | 1 | none | no | yes |
| `edges` | 0.5 | the ones between the first and the last | no | yes |

- The packed column starts at `base[c] + lead * max(0, rooms[c] - total)`.
- The drawing is shifted by `round(-low + lead * (wExtent - high + low))`. With 0.5 this is today's `round((wExtent - high - low) / 2)`, so `auto` needs no branch.

`start` is the start of the cross axis (top when horizontal, left when vertical), the same meaning as in `backFlows.side`. `solve`, the lanes, `straighten` and `fitColumn` do not change.

Alternatives: a separate option for the shift of the drawing (not taken: a chart packed at the start whose drawing is then centred is not at the start); comparing the enum in `placeSlots` and again for the shift (not taken after review: two copies of one rule).

The maintainer chose packing over "anchor one end and still align the rest" for `start` and `end`.

### `edges`

Asked for by the maintainer: the outermost ones packed at the start and at the end, the others in the middle automatically. Named `'edges'` by the maintainer, although `modeX` has a value `'edge'` that means something else on the other axis.

- The first slot of a column sits at the start of its room and the last at the end. A pass fits the slots between them with their packed places and the same free room: between two pinned slots the legal range of an inner slot is exactly its packed place plus `[0, free]`, which is what `fitColumn` already produces.
- "Outermost" means slots, not nodes: when the outermost slot is a waypoint, the flow runs along the edge and the first node comes after it. The order is fixed, so that node could not be at the edge itself.
- The only slot of a column goes to the edge nearer to where its flows meet: each pass fits it as `auto` does and then puts it at the start when the fit is in the first half of the free room, else at the end, so the columns placed after it see where it is.
- The drawing as a whole is centred as with `auto`.
- Levelling runs as with the other values and may move a pinned waypoint off its edge.

### A drawing that does not fit

When the minimum sizes of a column take more than the cross axis, the column starts at the start of its room and overflows, as today. The shift then follows the rule above: with `start` everything that does not fit is past the end edge, with `end` before the start edge, and with `auto` and `edges` it is split as today. A drawing that fits with `auto` fits with every value.

### Lanes before the content keep their own depth per column

With `start` and lanes before the content, a column under a lane starts after it and a column beside the lanes starts at the edge. Alternative: all columns flush at the deepest lane. Not taken: `solve` budgets the room per column, so a full column would overflow and the scale would have to change.

### Skipping flows are levelled with the new values

The maintainer decided that the flows that skip columns are made level also with `start` and `end`, although a column such a flow passes is then not exactly packed, and the same for `edges`. With `auto` nothing changes: levelling is off only with `nodePaddingMode: 'even'`.

### `nodePaddingMode` is deprecated and removed in 1.0 without a replacement

It acts only with `nodeAlign: 'auto'` (`rigid` is false with every other value). The `@deprecated` tag and the docs say: it keeps working until 1.0, it is removed there, and `nodeAlign: 'start'` or `'end'` give exactly the requested gaps. They do not say that `nodeAlign` replaces `'even'`, because no value draws what `'even'` draws. The maintainer decided the removal without a replacement.

The deprecation ships in the same piece as the option: the tag names `nodeAlign`, it changes the same files, and it has no test of its own.

### What the review changed

- The lead of a column and the shift of the drawing come from one number per value instead of two three-way branches (complexity review).
- `align` and `paddingMode` are resolved once in `computeGeometry` (architecture review).
- The rule for a drawing that does not fit is written down and tested; the first draft promised that nothing leaves the area further than with `auto`, which the shift cannot keep (architecture and rule-readers reviews).
- The spec no longer says that skipping flows are level with every value: `auto` with `'even'` is not (scope review).
- The sentences of the docs that state the old rule are listed in the tasks (rule-readers review).
- The deprecation moved into the piece of the option, and its wording no longer names a replacement (all three reviews).
- Tests for the unknown value, the other half of the lane cases and `edges` on an axis the drawing does not fill were added; the browser fixtures were cut to the two outputs the unit tests cannot show (scope and complexity reviews).

## Risks / Trade-offs

- `start` and `end` give up the alignment of nodes with their flows: on the densest fixture (`issues/issue72`) a prototype more than doubled how far the flows wander across the columns. The docs say so.
- With skipping flows a packed column is only nearly packed. This is the maintainer's choice; a user who wants exact packing has no switch for it.
- Under `edges` it has not been shown that levelling never moves a pinned node (as opposed to a waypoint). The unit test of P1 asserts it; if it fails, the builder stops and asks.
- The prototype was tried only horizontally and only on one fixture; the vertical case and the lanes are covered by new tests.
- `'edges'` next to `modeX: 'edge'`, and `nodeAlign` meaning something else in d3-sankey, can be misread; the docs name the axis.

## Pieces

| # | Builds | Files | Test that fails without it | Size | Waits on | Issues |
|---|---|---|---|---|---|---|
| P1 | The geometry takes `align`: resolved once, the lead and the passes in `placeSlots`, the shift of the drawing. Not reachable from the options, so nothing visible changes. Commit type `refactor`. | `src/lib/geometry.ts`, `src/lib/geometry.test.ts` | New unit tests, see tasks 1.1 | ~200 (30 source) | nothing | none |
| P2 | The option `nodeAlign` and the deprecation of `nodePaddingMode`: types, default, pass-through, docs, sample, browser tests. Commit type `feat`. | `src/types.ts`, `src/controller.ts`, `src/content/docs/usage.mdx`, `src/content/docs/samples/node-align.md`, `src/content/docs/samples/node-padding.md`, `astro.config.mjs`, `test/types/options.ts`, `test/specs/runtime-option-updates.spec.js`, two new fixtures under `test/fixtures/` | The two fixtures (the option is ignored, so the image is the `auto` one), the runtime tests, the type test | ~340 | P1, #496 | none |

P1 can be built now. P2 changes two files #496 holds and waits until that pull request is merged or closed.

## Contracts

- P1 → P2: `computeGeometry(plan, { ..., align })` accepts `'auto' | 'start' | 'end' | 'edges'` with the rules above; `align` absent means `'auto'`, and with `'auto'` every existing test and image is unchanged.

## Open Questions

None.
