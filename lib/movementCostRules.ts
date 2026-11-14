import {
  TerrainJob,
  terrainJobTurns,
} from '@civ-clone/base-terrain-properties/lib/jobTurns';
import {
  TileImprovementRegistry,
  instance as tileImprovementRegistryInstance,
} from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import {
  TransportRegistry,
  instance as transportRegistryInstance,
} from '@civ-clone/core-unit-transport/TransportRegistry';
import Action from '@civ-clone/core-unit/Action';
import Air from '@civ-clone/base-unit-type-air/Air';
import Criterion from '@civ-clone/core-rule/Criterion';
import Effect from '@civ-clone/core-rule/Effect';
import Land from '@civ-clone/base-unit-type-land/Land';
import MovementCost from '@civ-clone/core-unit/Rules/MovementCost';
import Naval from '@civ-clone/base-unit-type-naval/Naval';
import NavalTransport from '@civ-clone/base-unit-type-naval-transport/NavalTransport';
import Terrain from '@civ-clone/core-terrain/Terrain';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
import Unit from '@civ-clone/core-unit/Unit';

type ActionType = abstract new (...args: any[]) => Action;

export interface MovementCostDependencies {
  tileImprovementRegistry?: TileImprovementRegistry;
  transportRegistry?: TransportRegistry;
}

export interface MovementCostOptions {
  // The ruleset's move action.
  Move: ActionType;
  // What a land unit's move onto a terrain costs, or `null` where it has no cost (a lookup: this is the hot path).
  terrainCost: (terrain: Terrain) => number | null;
  // Routes, each `[name, improvement, cost]`: a land unit moving from a square with the improvement to another with it
  //  pays `cost` (the cheapest answer wins).
  routes: [string, typeof TileImprovement, number][];
  // Orders given on the unit's own square, each costing `multiplier` times the square's terrain cost.
  orders: [ActionType, number][];
  // Terrain jobs, each the turns it takes on each terrain (`base-terrain-properties`' `TerrainJob`).
  jobs: TerrainJob<ActionType>[];
}

/**
 * A ruleset's `MovementCost` rules, with ids `<prefix>:unit/movement-cost/<name>` as civ1-unit's are: moving by
 * terrain, aircraft and ships at 1, each route, cargo carried free, the orders given on a square, and the terrain jobs.
 * A move takes the cheapest answer; a job, the dearest.
 */
export const movementCostRules = (
  prefix: string,
  {
    tileImprovementRegistry = tileImprovementRegistryInstance,
    transportRegistry = transportRegistryInstance,
  }: MovementCostDependencies,
  { Move, terrainCost, routes, orders, jobs }: MovementCostOptions
): MovementCost[] => {
  const id = (name: string): string => `${prefix}:unit/movement-cost/${name}`,
    isMove = new Criterion(
      (unit: Unit, action: Action): boolean => action instanceof Move
    ),
    has = (
      Improvement: typeof TileImprovement,
      tile: (action: Action) => ReturnType<Action['to']>
    ): Criterion =>
      new Criterion((unit: Unit, action: Action): boolean =>
        tileImprovementRegistry
          .getByTile(tile(action))
          .some(
            (improvement: TileImprovement): boolean =>
              improvement instanceof Improvement
          )
      ),
    jobTurns = (Job: ActionType, terrain: Terrain): number | null =>
      terrainJobTurns(jobs, Job, terrain);

  return [
    new MovementCost(
      id('move'),
      isMove,
      new Criterion((unit: Unit): boolean => unit instanceof Land),
      new Criterion(
        (unit: Unit, action: Action): boolean =>
          terrainCost(action.to().terrain()) !== null
      ),
      new Effect(
        (unit: Unit, action: Action): number =>
          terrainCost(action.to().terrain()) as number
      )
    ),
    new MovementCost(
      id('air-and-naval'),
      isMove,
      new Criterion(
        (unit: Unit): boolean => unit instanceof Air || unit instanceof Naval
      ),
      new Effect((): number => 1)
    ),
    ...routes.map(
      ([name, Improvement, cost]): MovementCost =>
        new MovementCost(
          id(name),
          isMove,
          new Criterion((unit: Unit): boolean => unit instanceof Land),
          has(Improvement, (action: Action) => action.from()),
          has(Improvement, (action: Action) => action.to()),
          new Effect((): number => cost)
        )
    ),
    new MovementCost(
      id('transported'),
      isMove,
      new Criterion((unit: Unit): boolean => unit instanceof Land),
      // `hasUnit` first: asked for every land unit's every move, and `getByUnit` answers "no" by throwing.
      new Criterion((unit: Unit): boolean => transportRegistry.hasUnit(unit)),
      new Criterion(
        (unit: Unit): boolean =>
          transportRegistry.getByUnit(unit).transport() instanceof
          NavalTransport
      ),
      new Effect((): number => 0)
    ),
    new MovementCost(
      // An aircraft aboard a carrier moves with it for free; taking off costs as normal.
      id('transported/air'),
      isMove,
      new Criterion((unit: Unit): boolean => unit instanceof Air),
      new Criterion((unit: Unit): boolean => transportRegistry.hasUnit(unit)),
      new Criterion(
        (unit: Unit, action: Action): boolean =>
          transportRegistry.getByUnit(unit).transport().tile() === action.to()
      ),
      new Effect((): number => 0)
    ),
    ...orders.map(
      ([Order, multiplier]): MovementCost =>
        new MovementCost(
          id(`action/${Order.name}`),
          new Criterion(
            (unit: Unit, action: Action): boolean => action instanceof Order
          ),
          new Criterion(
            (unit: Unit): boolean => terrainCost(unit.tile().terrain()) !== null
          ),
          new Effect(
            (unit: Unit): number =>
              multiplier * (terrainCost(unit.tile().terrain()) as number)
          )
        )
    ),
    ...jobs.map(
      ([Job]: TerrainJob<ActionType>): MovementCost =>
        new MovementCost(
          id(`action/${Job.name}`),
          new Criterion(
            (unit: Unit, action: Action): boolean => action instanceof Job
          ),
          new Criterion(
            (unit: Unit): boolean =>
              jobTurns(Job, unit.tile().terrain()) !== null
          ),
          new Effect(
            (unit: Unit): number =>
              jobTurns(Job, unit.tile().terrain()) as number
          )
        )
    ),
  ];
};

export default movementCostRules;
