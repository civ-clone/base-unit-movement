"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movementCostRules = void 0;
const jobTurns_1 = require("@civ-clone/base-terrain-properties/lib/jobTurns");
const TileImprovementRegistry_1 = require("@civ-clone/core-tile-improvement/TileImprovementRegistry");
const TransportRegistry_1 = require("@civ-clone/core-unit-transport/TransportRegistry");
const Air_1 = require("@civ-clone/base-unit-type-air/Air");
const Criterion_1 = require("@civ-clone/core-rule/Criterion");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const Land_1 = require("@civ-clone/base-unit-type-land/Land");
const MovementCost_1 = require("@civ-clone/core-unit/Rules/MovementCost");
const Naval_1 = require("@civ-clone/base-unit-type-naval/Naval");
const NavalTransport_1 = require("@civ-clone/base-unit-type-naval-transport/NavalTransport");
/**
 * A ruleset's `MovementCost` rules, with ids `<prefix>:unit/movement-cost/<name>` as civ1-unit's are: moving by
 * terrain, aircraft and ships at 1, each route, cargo carried free, the orders given on a square, and the terrain jobs.
 * A move takes the cheapest answer; a job, the dearest.
 */
const movementCostRules = (prefix, { tileImprovementRegistry = TileImprovementRegistry_1.instance, transportRegistry = TransportRegistry_1.instance, }, { Move, terrainCost, routes, orders, jobs }) => {
    const id = (name) => `${prefix}:unit/movement-cost/${name}`, isMove = new Criterion_1.default((unit, action) => action instanceof Move), has = (Improvement, tile) => new Criterion_1.default((unit, action) => tileImprovementRegistry
        .getByTile(tile(action))
        .some((improvement) => improvement instanceof Improvement)), jobTurns = (Job, terrain) => (0, jobTurns_1.terrainJobTurns)(jobs, Job, terrain);
    return [
        new MovementCost_1.default(id('move'), isMove, new Criterion_1.default((unit) => unit instanceof Land_1.default), new Criterion_1.default((unit, action) => terrainCost(action.to().terrain()) !== null), new Effect_1.default((unit, action) => terrainCost(action.to().terrain()))),
        new MovementCost_1.default(id('air-and-naval'), isMove, new Criterion_1.default((unit) => unit instanceof Air_1.default || unit instanceof Naval_1.default), new Effect_1.default(() => 1)),
        ...routes.map(([name, Improvement, cost]) => new MovementCost_1.default(id(name), isMove, new Criterion_1.default((unit) => unit instanceof Land_1.default), has(Improvement, (action) => action.from()), has(Improvement, (action) => action.to()), new Effect_1.default(() => cost))),
        new MovementCost_1.default(id('transported'), isMove, new Criterion_1.default((unit) => unit instanceof Land_1.default), 
        // `hasUnit` first: asked for every land unit's every move, and `getByUnit` answers "no" by throwing.
        new Criterion_1.default((unit) => transportRegistry.hasUnit(unit)), new Criterion_1.default((unit) => transportRegistry.getByUnit(unit).transport() instanceof
            NavalTransport_1.default), new Effect_1.default(() => 0)),
        new MovementCost_1.default(
        // An aircraft aboard a carrier moves with it for free; taking off costs as normal.
        id('transported/air'), isMove, new Criterion_1.default((unit) => unit instanceof Air_1.default), new Criterion_1.default((unit) => transportRegistry.hasUnit(unit)), new Criterion_1.default((unit, action) => transportRegistry.getByUnit(unit).transport().tile() === action.to()), new Effect_1.default(() => 0)),
        ...orders.map(([Order, multiplier]) => new MovementCost_1.default(id(`action/${Order.name}`), new Criterion_1.default((unit, action) => action instanceof Order), new Criterion_1.default((unit) => terrainCost(unit.tile().terrain()) !== null), new Effect_1.default((unit) => multiplier * terrainCost(unit.tile().terrain())))),
        ...jobs.map(([Job]) => new MovementCost_1.default(id(`action/${Job.name}`), new Criterion_1.default((unit, action) => action instanceof Job), new Criterion_1.default((unit) => jobTurns(Job, unit.tile().terrain()) !== null), new Effect_1.default((unit) => jobTurns(Job, unit.tile().terrain())))),
    ];
};
exports.movementCostRules = movementCostRules;
exports.default = exports.movementCostRules;
//# sourceMappingURL=movementCostRules.js.map