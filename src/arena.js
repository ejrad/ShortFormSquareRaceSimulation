import { config } from './config.js';

export function createArena(world) {
    const { width, height, wallThickness, wallBounciness } = config.arena;
    
    const options = {
        isStatic: true,
        restitution: wallBounciness,
        render: { fillStyle: '#333333' }
    };

    // Walls
    const ground = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, options);
    const ceiling = Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, options);
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, options);
    const rightWall = Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, options);

    Matter.World.add(world, [ground, ceiling, leftWall, rightWall]);
}
