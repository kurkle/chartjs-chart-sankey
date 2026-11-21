## Purpose

Where the nodes of a column sit along the cross axis of a Sankey chart (top to bottom in a horizontal chart, left to right in a vertical one), and where the drawing sits when it does not fill that axis.

## ADDED Requirements

### Requirement: The default placement is unchanged

A chart without `nodeAlign`, with `nodeAlign: 'auto'` or with a value that is not one of the documented ones SHALL be drawn exactly as it was before the option existed, with either value of `nodePaddingMode`.

#### Scenario: The option is absent

- **WHEN** a chart is drawn without `nodeAlign`
- **THEN** every node and flow is where it was before the option existed

#### Scenario: The value is unknown

- **WHEN** `nodeAlign` is set to a value that is not documented
- **THEN** the chart is drawn as with `'auto'`

### Requirement: `start` packs every column at the start of the cross axis

With `nodeAlign: 'start'` every column SHALL be packed from the start of the cross axis with exactly the requested gaps between its nodes, and the nodes SHALL NOT be moved towards their flows.

#### Scenario: A horizontal chart without back flows or skipping flows

- **WHEN** `nodeAlign` is `'start'` on a horizontal chart that has no back flows and no flow that skips a column
- **THEN** the first node of every column touches the top of the chart area
- **THEN** every gap between two nodes of a column is the requested gap

#### Scenario: A vertical chart

- **WHEN** `nodeAlign` is `'start'` on a vertical chart that has no back flows and no flow that skips a column
- **THEN** the first node of every column touches the left edge of the chart area

#### Scenario: The drawing does not fill the cross axis

- **WHEN** `nodeAlign` is `'start'` and the scale is limited by the column axis or by minimum node sizes, so that the drawing is shorter than the cross axis
- **THEN** the drawing starts at the start edge and all the spare room is after it

#### Scenario: A column does not fit the cross axis

- **WHEN** `nodeAlign` is `'start'` and the minimum sizes of the nodes of a column take more than the cross axis
- **THEN** the drawing starts at the start edge and all of what does not fit is past the end edge

### Requirement: `end` packs every column at the end of the cross axis

With `nodeAlign: 'end'` every column SHALL be packed against the end of the cross axis with exactly the requested gaps between its nodes, and the nodes SHALL NOT be moved towards their flows.

#### Scenario: A horizontal chart without back flows or skipping flows

- **WHEN** `nodeAlign` is `'end'` on a horizontal chart that has no back flows and no flow that skips a column
- **THEN** the last node of every column touches the bottom of the chart area
- **THEN** every gap between two nodes of a column is the requested gap

#### Scenario: The drawing does not fill the cross axis

- **WHEN** `nodeAlign` is `'end'` and the drawing is shorter than the cross axis
- **THEN** the drawing ends at the end edge and all the spare room is before it

#### Scenario: A column does not fit the cross axis

- **WHEN** `nodeAlign` is `'end'` and the minimum sizes of the nodes of a column take more than the cross axis
- **THEN** the drawing ends at the end edge and all of what does not fit is before the start edge

### Requirement: `edges` pins the outermost slots of a column

With `nodeAlign: 'edges'` the first slot of a column with two or more slots SHALL sit at the start of the room of that column and the last one at its end, and the slots between them SHALL be placed as `'auto'` places them, never closer to a neighbour than the requested gap. A slot is a node or the place a flow takes in a column it skips.

#### Scenario: A column of three or more nodes

- **WHEN** `nodeAlign` is `'edges'` and a column has three or more nodes and no flow that skips it
- **THEN** its first node touches the start edge and its last node the end edge
- **THEN** the nodes between them are at least the requested gap from their neighbours

#### Scenario: A column of two nodes

- **WHEN** `nodeAlign` is `'edges'` and a column has two nodes
- **THEN** one node is at each edge

#### Scenario: A skipping flow at the edge of a column

- **WHEN** `nodeAlign` is `'edges'` and the first slot of a column is the place of a flow that skips the column
- **THEN** that flow runs along the start edge and the first node of the column comes after it

### Requirement: `edges` puts the only slot of a column at the nearer edge

With `nodeAlign: 'edges'` the only slot of a column SHALL sit at the edge of the room of the column that is nearer to where its flows meet.

#### Scenario: A column of one node

- **WHEN** `nodeAlign` is `'edges'` and a column has one node whose flows meet it in the first half of the room of the column
- **THEN** the node touches the start edge

### Requirement: `edges` centres a drawing that does not fill the cross axis

With `nodeAlign: 'edges'` a drawing that is shorter than the cross axis SHALL be centred on it, as with `'auto'`.

#### Scenario: The scale is limited by the column axis

- **WHEN** `nodeAlign` is `'edges'` and the drawing is shorter than the cross axis
- **THEN** the spare room is shared before and after the drawing

### Requirement: Flows that skip columns stay level

A flow that skips columns SHALL run level across them where the columns have the room, with `nodeAlign` `'start'`, `'end'` or `'edges'`, and with `'auto'` unless `nodePaddingMode` is `'even'`. A column such a flow passes MAY then sit off its edge or have one gap wider than requested.

#### Scenario: A skipping flow with `start`

- **WHEN** `nodeAlign` is `'start'` and a flow skips two columns that have room for it at one level
- **THEN** the flow runs at one level across both columns

#### Scenario: `even` with `auto` is not levelled

- **WHEN** `nodeAlign` is `'auto'` and `nodePaddingMode` is `'even'`
- **THEN** the flows that skip columns are not held level, as before

### Requirement: Back flow lanes keep their room

The lanes of back flows SHALL stay next to the content with every value of `nodeAlign`, and a drawing that fits the chart area with `'auto'` SHALL fit it with every value.

#### Scenario: Lanes after the content with `start`

- **WHEN** `nodeAlign` is `'start'` and the back flows run after the content
- **THEN** the lanes run right after the content, not at the far edge of the chart area

#### Scenario: Lanes before the content with `start`

- **WHEN** `nodeAlign` is `'start'` and the back flows run before the content
- **THEN** the outermost lane sits at the start edge with its usual gap to the edge
- **THEN** a column under a lane starts after the lane, and a column beside the lanes starts at the edge

#### Scenario: Lanes with `end`

- **WHEN** `nodeAlign` is `'end'`
- **THEN** the two scenarios above hold mirrored

### Requirement: `nodePaddingMode` acts only with `auto`

`nodePaddingMode` SHALL have an effect only while `nodeAlign` is `'auto'`, where it works as before. It SHALL be marked deprecated in the types and in the docs, which say that it is removed in 1.0 without a replacement and that `nodeAlign: 'start'` and `'end'` give exactly the requested gaps.

#### Scenario: `even` with `start`

- **WHEN** `nodeAlign` is `'start'` and `nodePaddingMode` is `'even'`
- **THEN** the chart is drawn as with `nodeAlign: 'start'` alone

#### Scenario: `even` with `auto`

- **WHEN** `nodeAlign` is `'auto'` and `nodePaddingMode` is `'even'`
- **THEN** the chart is drawn as it was before `nodeAlign` existed

### Requirement: The option can change at runtime

A change of `nodeAlign` in the options of a chart SHALL take effect on the next update.

#### Scenario: Switching from `auto` to `start`

- **WHEN** `nodeAlign` is changed from `'auto'` to `'start'` and the chart is updated
- **THEN** the next draw has every column packed at the start
