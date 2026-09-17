import { config } from './config.js';

export function spawnRacers(world, field) {
    const rc = field.racers;
    const size = rc.size ?? config.racers.size;
    const restitution = rc.restitution ?? config.racers.restitution;
    const friction = rc.friction ?? config.racers.friction;
    const density = rc.density ?? config.racers.density;
    const speed = rc.speed ?? 8;

    const racers = [];

    for (let i = 0; i < rc.colors.length; i++) {
        const { name, hex } = rc.colors[i];
        const pos = rc.spawnPoints[i] ?? rc.spawnPoints[rc.spawnPoints.length - 1];

        const racer = Matter.Bodies.rectangle(pos.x, pos.y, size, size, {
            restitution,
            friction,
            frictionAir: 0,
            frictionStatic: 0,
            density,
            inertia: Infinity,
            inverseInertia: 0,
            render: { fillStyle: hex }
        });

        racer.colorKey = name;
        racer.targetSpeed = speed;
        racer.initialAngle = Math.random() * Math.PI * 2;
        racer.trail = [{ x: pos.x, y: pos.y }];

        Matter.Body.setVelocity(racer, { x: 0, y: 0 });
        racers.push(racer);
    }

    Matter.World.add(world, racers);
    return racers;
}

export function updateRacers(racers) {
    for (const racer of racers) {
        // Lock rotation and angular velocity
        Matter.Body.setAngle(racer, 0);
        Matter.Body.setAngularVelocity(racer, 0);

        // Check speed boost expiration (e.g. from Monster Energy item)
        if (racer.boostEndTime && Date.now() >= racer.boostEndTime) {
            racer.targetSpeed = racer.baseSpeed ?? 8;
            racer.boostEndTime = null;
        }

        // Maintain constant speed magnitude while keeping current direction
        const currentSpeed = racer.speed;
        if (currentSpeed > 0) {
            const factor = racer.targetSpeed / currentSpeed;
            Matter.Body.setVelocity(racer, {
                x: racer.velocity.x * factor,
                y: racer.velocity.y * factor
            });
        }

        // Record trail points
        racer.trail.push({ x: racer.position.x, y: racer.position.y });
        if (racer.trail.length > 20) {
            racer.trail.shift();
        }
    }
}
