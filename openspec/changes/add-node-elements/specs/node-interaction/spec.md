## Purpose

What pointing at a node of a Sankey chart gives: its tooltip, the items that tooltip callbacks and event handlers receive for it, and the flows it highlights.

## ADDED Requirements

### Requirement: A node has a tooltip

With the default interaction, a pointer on the bar of a node where no flow is hit SHALL show a tooltip for the node, in addition to the tooltips of the flows. The default tooltip of a node has no title and one line: the label of the node and its flow, one number when it has flows on one side only or its in and out are equal, and both when they differ.

#### Scenario: Pointing at a node

- **WHEN** the mouse is on the bar of node `B`, whose flows in and out both sum to 30, and no flow is hit there
- **THEN** a tooltip with the line `B: 30` and no title is shown at the centre of the bar

#### Scenario: A node whose in and out differ

- **WHEN** the mouse is on the bar of node `B`, whose flows in sum to 30 and whose flows out sum to 25
- **THEN** the line is `B: 30 in, 25 out`

#### Scenario: A node with a label

- **WHEN** the dataset has `labels: { B: 'Bee' }` and the mouse is on the bar of `B`
- **THEN** the line is `Bee: 30`

#### Scenario: Moving between a node and a flow

- **WHEN** the mouse moves from the bar of a node onto one of its flows and back
- **THEN** the tooltip changes to the line of the flow and back to the line of the node

#### Scenario: Leaving the chart

- **WHEN** the mouse leaves the chart while a node's tooltip is shown
- **THEN** the tooltip is hidden

#### Scenario: A node that is moving

- **WHEN** the mouse is on a node while it moves during an update
- **THEN** the tooltip is shown at the bar as it is drawn

### Requirement: The flow wins where both are hit

A point where a flow is hit SHALL give the flow, also where the flow is drawn over the bar of a node or is hit within its reach around a thin band.

#### Scenario: Where a flow meets its node

- **WHEN** the mouse is where a flow meets the bar of its node
- **THEN** the flow is found and its tooltip is shown

#### Scenario: A thin flow inside a bar

- **WHEN** a thin flow is hit within a pixel and a half of its centre line, inside the bar of its node
- **THEN** the flow is found

### Requirement: Only the default mode finds nodes

Nodes SHALL be found only by the `'sankey'` interaction mode with `intersect`, in a chart whose visible datasets are all Sankey datasets.

#### Scenario: Another mode

- **WHEN** `interaction.mode` is `'nearest'`, or `intersect` is false, or the chart mixes in another chart type, and the mouse is on the bar of a node
- **THEN** no node is found

### Requirement: Callbacks can tell a node from a flow

Tooltip callbacks, tooltip filters and `onHover`/`onClick` SHALL receive for a node an item whose element is the exported node element, which holds the node.

#### Scenario: A label callback

- **WHEN** a `label` callback returns the key of the node when `context.element instanceof NodeElement`, and the flow text otherwise
- **THEN** the line of a node is its key and the lines of flows are unchanged

#### Scenario: A click

- **WHEN** the chart is clicked on the bar of a node
- **THEN** `onClick` gets one item whose element is the node element of that node

#### Scenario: The active elements

- **WHEN** a node is hovered
- **THEN** `chart.getActiveElements()` has one item whose element is the node element of that node

### Requirement: Pointing at a node resolves no flow options

Hovering a node or showing its tooltip SHALL NOT resolve the options of a flow, so scriptable flow options that read the data row do not run without a row.

#### Scenario: A scriptable colour that reads the row

- **WHEN** `colorFrom` is a function that reads `context.dataset.data[context.dataIndex].from` and the mouse is on the bar of a node with the tooltip on
- **THEN** nothing throws, and the colour box of the tooltip has the colour of the node

#### Scenario: The data changes while a node is hovered

- **WHEN** the data is replaced while the tooltip of a node is shown
- **THEN** the colour box of the tooltip has the colour of the node

#### Scenario: A legend with an empty dataset

- **WHEN** the legend is shown with `usePointStyle` and the dataset has no rows
- **THEN** nothing throws

### Requirement: Hovering a node highlights its flows

Hovering a node SHALL draw every flow into or out of it in its hover colours, and the bars of the nodes with them, as hovering one of those flows does.

#### Scenario: Hover and leave

- **WHEN** a node is hovered and then the mouse leaves it
- **THEN** while it is hovered every flow of the node, and no other flow, is drawn in its hover colours, and afterwards every flow is drawn in its own colours

#### Scenario: From a node to one of its flows

- **WHEN** the mouse moves from a node onto one of its flows
- **THEN** only that flow stays in its hover colours

#### Scenario: An update while hovered

- **WHEN** the chart is updated while a node is hovered
- **THEN** the flows of the node stay in their hover colours

#### Scenario: An update that changes the flows of a hovered node

- **WHEN** the data is replaced while node `A` is hovered, so that the flows of `A` are other rows or `A` is gone
- **THEN** only the flows `A` now has are in their hover colours, and none once the mouse leaves or `A` is gone
