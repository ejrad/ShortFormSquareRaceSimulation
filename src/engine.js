import { config } from './config.js';

export function setupEngine() {
    const engine = Matter.Engine.create();
    engine.world.gravity.y = config.physics.gravity;
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    return engine;
}
