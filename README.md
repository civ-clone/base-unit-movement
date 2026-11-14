# base-unit-movement

`lib/movementCostRules`: `movementCostRules(prefix, deps, options)`, a ruleset's `MovementCost` rules from its numbers,
with ids `<prefix>:unit/movement-cost/<name>`: a land unit's move by terrain (`terrainCost`, a lookup), aircraft and
ships at 1, each route (`[name, improvement, cost]`, both squares having it), land cargo carried free and an aircraft
moving with its carrier, the orders given on a square (a multiple of its terrain cost) and the terrain jobs
(base-terrain-properties' `TerrainJob` tables). A move takes the cheapest answer.

A library: no `main`, so it registers nothing on its own.
