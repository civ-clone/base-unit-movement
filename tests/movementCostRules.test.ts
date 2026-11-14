import * as fs from 'fs';
import * as path from 'path';
import Air from '@civ-clone/base-unit-type-air/Air';
import Land from '@civ-clone/base-unit-type-land/Land';
import MovementCost from '@civ-clone/core-unit/Rules/MovementCost';
import Naval from '@civ-clone/base-unit-type-naval/Naval';
import NavalTransport from '@civ-clone/base-unit-type-naval-transport/NavalTransport';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Terrain from '@civ-clone/core-terrain/Terrain';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
import { expect } from 'chai';
import movementCostRules from '../lib/movementCostRules';

// civ1-unit 0.1.40's own `Rules/Unit/movementCost` rules (835709d): id, rule type, priority and criteria count, in
//  order. With civ1-unit's prefix and options, the assembler gives exactly these (R2b adopts it unchanged).
const civ1: [string, string, number, number][] = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'tests/fixtures/civ1-unit-movement-cost.json'),
    'utf8'
  )
);

// Stand-ins, named as civ1's classes are: a rule id carries the class's name.
class Move {}
class Fortify {}
class Pillage {}
class Sleep {}
class BuildIrrigation {}
class BuildMine {}
class BuildRoad {}
class BuildRailroad {}
class CleanPollution {}
class ClearForest {}
class ClearJungle {}
class ClearSwamp {}
class PlantForest {}
class Road extends TileImprovement {}
class Railroad extends TileImprovement {}
class Grassland extends Terrain {}
class Hills extends Terrain {}
class Glacier extends Terrain {}

const terrainCost = (terrain: Terrain): number | null =>
  terrain instanceof Hills ? 2 : terrain instanceof Grassland ? 1 : null;

const options = {
  Move: Move as never,
  terrainCost,
  routes: [
    ['road', Road, 1 / 3],
    ['railroad', Railroad, 0],
  ] as [string, typeof TileImprovement, number][],
  orders: [
    [Fortify, 1],
    [Pillage, 1],
    [Sleep, 0],
  ] as [never, number][],
  jobs: [
    [BuildIrrigation, [[Hills, 10]]],
    [BuildMine, [[Hills, 10]]],
    [BuildRoad, (terrain: Terrain) => 2 * (terrainCost(terrain) ?? 0)],
    [BuildRailroad, (): number => 4],
    [CleanPollution, (): number => 4],
    [ClearForest, [[Hills, 5]]],
    [ClearJungle, [[Hills, 15]]],
    [ClearSwamp, [[Hills, 15]]],
    [PlantForest, [[Grassland, 10]]],
  ] as never[],
};

const unit = (Domain: Function, terrain: Terrain = new Hills()) =>
    Object.assign(Object.create(Domain.prototype), {
      tile: () => ({ terrain: () => terrain }),
    }),
  tile = (terrain: Terrain, name: string) => ({
    name,
    terrain: () => terrain,
  }),
  move = (from: object, to: object) =>
    Object.assign(Object.create(Move.prototype), {
      from: () => from,
      to: () => to,
    });

describe('movementCostRules', (): void => {
  it("gives civ1-unit's Rules/Unit/movementCost rules, in order", (): void => {
    expect(
      movementCostRules('civ1-unit', {}, options).map((rule) => [
        rule.id(),
        rule.constructor.name,
        rule.priority().value(),
        (rule as unknown as { _criteria: { _criteria: unknown[] } })._criteria
          ._criteria.length,
      ])
    ).to.deep.equal(civ1);
  });

  it('prices moves by terrain, domain and route, the cheapest answer winning as Move takes it', (): void => {
    const roads = new Set(['a', 'b', 'c']),
      rails = new Set(['b', 'c']),
      ruleRegistry = new RuleRegistry();

    ruleRegistry.register(
      ...movementCostRules(
        'game',
        {
          tileImprovementRegistry: {
            getByTile: (tile: { name: string }) => [
              ...(roads.has(tile.name) ? [new Road()] : []),
              ...(rails.has(tile.name) ? [new Railroad()] : []),
            ],
          } as never,
          transportRegistry: { hasUnit: (): boolean => false } as never,
        },
        options
      )
    );

    const cost = (mover: unknown, from: object, to: object): number =>
        Math.min(
          ...ruleRegistry.process(MovementCost, mover as never, move(from, to))
        ),
      hills = tile(new Hills(), 'x'),
      grass = tile(new Grassland(), 'y');

    expect(cost(unit(Land), grass, hills)).to.equal(2);
    expect(cost(unit(Land), hills, grass)).to.equal(1);
    expect(cost(unit(Air), grass, hills)).to.equal(1);
    expect(cost(unit(Naval), grass, hills)).to.equal(1);
    expect(
      cost(unit(Land), tile(new Hills(), 'a'), tile(new Hills(), 'b'))
    ).to.equal(1 / 3);
    expect(
      cost(unit(Land), tile(new Hills(), 'b'), tile(new Hills(), 'c'))
    ).to.equal(0);
    // A road on one end only is no road.
    expect(cost(unit(Land), tile(new Hills(), 'a'), hills)).to.equal(2);
    // A terrain with no cost has no rule that answers.
    expect(
      ruleRegistry.process(
        MovementCost,
        unit(Land) as never,
        move(hills, tile(new Glacier(), 'z'))
      )
    ).to.deep.equal([]);
  });

  it('carries cargo free, and an aircraft with its carrier', (): void => {
    const carrier = Object.assign(Object.create(NavalTransport.prototype), {
        tile: () => 'here',
      }),
      rules = movementCostRules(
        'game',
        {
          tileImprovementRegistry: { getByTile: () => [] } as never,
          transportRegistry: {
            hasUnit: (): boolean => true,
            getByUnit: () => ({ transport: () => carrier }),
          } as never,
        },
        options
      ),
      ruleRegistry = new RuleRegistry();

    ruleRegistry.register(...rules);

    const hills = tile(new Hills(), 'x');

    expect(
      ruleRegistry.process(
        MovementCost,
        unit(Land) as never,
        move(hills, hills)
      )
    ).to.include(0);
    expect(
      ruleRegistry.process(
        MovementCost,
        unit(Air) as never,
        move(hills, 'here')
      )
    ).to.include(0);
    expect(
      ruleRegistry.process(MovementCost, unit(Air) as never, move(hills, hills))
    ).to.deep.equal([1]);
  });

  it('prices orders by the square, and jobs by their own table less the turn they are given on', (): void => {
    const ruleRegistry = new RuleRegistry(),
      order = (Type: Function) => Object.create(Type.prototype);

    ruleRegistry.register(...movementCostRules('game', {}, options));

    const on = (terrain: Terrain, Type: Function): number[] =>
      ruleRegistry.process(
        MovementCost,
        unit(Land, terrain) as never,
        order(Type)
      );

    expect(on(new Hills(), Fortify)).to.deep.equal([2]);
    expect(on(new Hills(), Sleep)).to.deep.equal([0]);
    expect(on(new Hills(), BuildMine)).to.deep.equal([9]);
    expect(on(new Grassland(), BuildMine)).to.deep.equal([]);
    expect(on(new Grassland(), BuildRoad)).to.deep.equal([1]);
    expect(on(new Glacier(), Fortify)).to.deep.equal([]);
  });
});
