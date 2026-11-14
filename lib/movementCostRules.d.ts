import { TerrainJob } from '@civ-clone/base-terrain-properties/lib/jobTurns';
import { TileImprovementRegistry } from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import { TransportRegistry } from '@civ-clone/core-unit-transport/TransportRegistry';
import Action from '@civ-clone/core-unit/Action';
import MovementCost from '@civ-clone/core-unit/Rules/MovementCost';
import Terrain from '@civ-clone/core-terrain/Terrain';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
type ActionType = abstract new (...args: any[]) => Action;
export interface MovementCostDependencies {
  tileImprovementRegistry?: TileImprovementRegistry;
  transportRegistry?: TransportRegistry;
}
export interface MovementCostOptions {
  Move: ActionType;
  terrainCost: (terrain: Terrain) => number | null;
  routes: [string, typeof TileImprovement, number][];
  orders: [ActionType, number][];
  jobs: TerrainJob<ActionType>[];
}
/**
 * A ruleset's `MovementCost` rules, with ids `<prefix>:unit/movement-cost/<name>` as civ1-unit's are: moving by
 * terrain, aircraft and ships at 1, each route, cargo carried free, the orders given on a square, and the terrain jobs.
 * A move takes the cheapest answer; a job, the dearest.
 */
export declare const movementCostRules: (
  prefix: string,
  { tileImprovementRegistry, transportRegistry }: MovementCostDependencies,
  { Move, terrainCost, routes, orders, jobs }: MovementCostOptions
) => MovementCost[];
export default movementCostRules;
