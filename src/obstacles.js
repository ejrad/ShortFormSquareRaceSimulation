import { config } from './config.js';
import { playNextMelodyNote, playBreakSound } from './audio.js';

export class Obstacle {
    constructor(x, y, width, height, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.body = Matter.Bodies.rectangle(x, y, width, height, {
            isStatic: true,
            restitution: options.restitution ?? 1.0,
            angle: options.angle ?? 0,
            render: {
                fillStyle: options.fillStyle ?? '#4a5568'
            }
        });
    }

    addToWorld(world) {
        Matter.World.add(world, this.body);
    }
}

export class WallObstacle extends Obstacle {
    constructor(x, y, width, height, angle = 0) {
        super(x, y, width, height, { angle, fillStyle: '#4a5568' });
    }
}

export class PegObstacle extends Obstacle {
    constructor(x, y, radius = 10) {
        super(x, y, radius * 2, radius * 2);
        this.body = Matter.Bodies.circle(x, y, radius, {
            isStatic: true,
            restitution: 1.0,
            render: { fillStyle: '#888888' }
        });
    }
}

export class BaffleObstacle extends WallObstacle {
    constructor(x, y, width, height) {
        super(x, y, width, height);
    }
}

export class BreakableObstacle extends Obstacle {
    constructor(x, y, width, height, hits = 10, options = {}) {
        super(x, y, width, height, {
            ...options,
            fillStyle: options.fillStyle ?? '#e53e3e'
        });
        this.hitsLeft = hits;
        this.maxHits = hits;
        this.isBroken = false;
        this.body.obstacleRef = this;
    }

    hit(world) {
        if (this.isBroken) return;
        this.hitsLeft--;
        playBreakSound();
        if (this.hitsLeft <= 0) {
            this.isBroken = true;
            Matter.World.remove(world, this.body);
        }
    }
}

export class ColorBreakableObstacle extends BreakableObstacle {
    constructor(x, y, width, height, colorKey, hexColor, hits = 1, options = {}) {
        super(x, y, width, height, hits, { ...options, fillStyle: hexColor });
        this.requiredColor = colorKey;
    }
}

export class EnemyObstacle {
    constructor(x, y, width, height, hits = 50, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.hitsLeft = hits;
        this.maxHits = hits;
        this.color = options.color ?? '#ff0055';
        this.speed = options.speed ?? 6;
        this.isBroken = false;

        this.body = Matter.Bodies.rectangle(x, y, width, height, {
            isStatic: false,
            restitution: options.restitution ?? 1.0,
            friction: options.friction ?? 0.0,
            frictionAir: 0,
            frictionStatic: 0,
            density: options.density ?? 0.002,
            inertia: Infinity,
            inverseInertia: 0,
            render: { fillStyle: this.color }
        });
        this.body.obstacleRef = this;

        const angle = options.initialAngle ?? Math.random() * Math.PI * 2;
        Matter.Body.setVelocity(this.body, {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        });
    }

    addToWorld(world) {
        Matter.World.add(world, this.body);
    }

    hit(world) {
        if (this.isBroken) return;
        this.hitsLeft--;
        playBreakSound();
        if (this.hitsLeft <= 0) {
            this.isBroken = true;
            Matter.World.remove(world, this.body);
        }
    }

    update() {
        if (this.isBroken) return;
        Matter.Body.setAngle(this.body, 0);
        Matter.Body.setAngularVelocity(this.body, 0);

        const currentSpeed = this.body.speed;
        if (currentSpeed > 0) {
            const factor = this.speed / currentSpeed;
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x * factor,
                y: this.body.velocity.y * factor
            });
        }
    }

    draw(ctx) {
        if (this.isBroken) return;
        const pos = this.body.position;
        const halfW = this.width / 2;
        const halfH = this.height / 2;

        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.fillRect(pos.x - halfW, pos.y - halfH, this.width, this.height);
        ctx.strokeRect(pos.x - halfW, pos.y - halfH, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.hitsLeft}`, pos.x, pos.y);
        ctx.restore();
    }
}

export class PortalObstacle {
    constructor(entrance, exit, options = {}) {
        this.width = options.width ?? 60;
        this.height = options.height ?? 60;
        this.cooldownMs = options.cooldownMs ?? 300;
        this.imageSrc = options.imageSrc ?? './src/portal.gif';

        // Target destinations
        this.entrance = entrance; // { x, y }
        this.exit = exit;         // { x, y }

        this.image = new Image();
        this.image.src = this.imageSrc;

        // Sensor bodies for collision detection without physical bounce
        this.entranceBody = Matter.Bodies.rectangle(entrance.x, entrance.y, this.width, this.height, {
            isStatic: true,
            isSensor: true
        });
        this.exitBody = Matter.Bodies.rectangle(exit.x, exit.y, this.width, this.height, {
            isStatic: true,
            isSensor: true
        });

        this.entranceBody.portalRef = { portal: this, isEntrance: true };
        this.exitBody.portalRef = { portal: this, isEntrance: false };
    }

    addToWorld(world) {
        Matter.World.add(world, [this.entranceBody, this.exitBody]);
    }

    teleport(racer, fromEntrance) {
        const now = Date.now();
        if (racer.lastPortalTime && (now - racer.lastPortalTime < this.cooldownMs)) {
            return;
        }

        const target = fromEntrance ? this.exit : this.entrance;

        // Maintain velocity direction and magnitude while moving position
        Matter.Body.setPosition(racer, { x: target.x, y: target.y });
        racer.lastPortalTime = now;

        // Clear racer trail so line doesn't stretch across canvas on teleport
        if (racer.trail) racer.trail = [];
    }
}

export class SwordWeapon {
    constructor(spec = {}) {
        this.spawnX = spec.x ?? 540;
        this.spawnY = spec.y ?? 960;
        this.width = spec.width ?? 40;
        this.height = spec.height ?? 120;
        this.imageSrc = spec.imageSrc ?? './src/sword.png';
        this.respawnDelayMs = spec.respawnDelayMs ?? 5000;

        this.image = new Image();
        this.image.src = this.imageSrc;

        this.holder = null;
        this.isSpawned = true;
        this.respawnTime = 0;

        // Pickup sensor body on ground
        this.pickupBody = Matter.Bodies.rectangle(this.spawnX, this.spawnY, this.width, this.height, {
            isStatic: true,
            isSensor: true,
            render: { visible: false }
        });
        this.pickupBody.weaponRef = this;
    }

    addToWorld(world) {
        Matter.World.add(world, this.pickupBody);
    }

    pickup(racer) {
        if (!this.isSpawned || this.holder) return;
        this.isSpawned = false;
        this.holder = racer;
        racer.weapon = this;
    }

    onHitOtherRacer(world, hitRacer, racers) {
        // Kill the hit racer
        if (window.deathMarkers) {
            window.deathMarkers.push({
                x: hitRacer.position.x,
                y: hitRacer.position.y,
                size: config.racers.size,
                color: hitRacer.render.fillStyle
            });
        }
        if (window.confettiParticles) {
            const particleCount = 180;
            for (let p = 0; p < particleCount; p++) {
                const angle = (Math.PI * 2 * p) / particleCount + (Math.random() - 0.5) * 0.4;
                const speed = 3 + Math.random() * 16;
                window.confettiParticles.push({
                    x: hitRacer.position.x,
                    y: hitRacer.position.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 6 + Math.random() * 12,
                    color: hitRacer.render.fillStyle,
                    alpha: 1.0,
                    rotation: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.35
                });
            }
        }
        const index = racers.indexOf(hitRacer);
        if (index !== -1) {
            Matter.World.remove(world, hitRacer);
            racers.splice(index, 1);
        }

        // Sword taken away and queued for respawn
        if (this.holder) {
            this.holder.weapon = null;
            this.holder = null;
        }
        this.respawnTime = Date.now() + this.respawnDelayMs;
    }

    update(racers, world) {
        const now = Date.now();

        // Respawn check
        if (!this.isSpawned && !this.holder && now >= this.respawnTime) {
            this.isSpawned = true;
        }

        // Held state logic: find closest opponent and check sword attack collision
        if (this.holder) {
            // If holder died/removed
            if (!racers.includes(this.holder)) {
                this.holder.weapon = null;
                this.holder = null;
                this.respawnTime = now + this.respawnDelayMs;
                return;
            }

            const holderPos = this.holder.position;
            let closestRacer = null;
            let minDistSq = Infinity;

            for (const r of racers) {
                if (r === this.holder) continue;
                const dx = r.position.x - holderPos.x;
                const dy = r.position.y - holderPos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestRacer = r;
                }
            }

            if (closestRacer) {
                const angle = Math.atan2(closestRacer.position.y - holderPos.y, closestRacer.position.x - holderPos.x);
                this.angle = angle;

                // Sword tip position check (hitbox calculation)
                const swordTipX = holderPos.x + Math.cos(angle) * (this.height);
                const swordTipY = holderPos.y + Math.sin(angle) * (this.height);

                // Simple box/circle vs square check along sword length
                const racerSize = config.racers.size;
                const targetPos = closestRacer.position;

                // Check distance from target position to sword segment [holderPos -> swordTip]
                const segDx = swordTipX - holderPos.x;
                const segDy = swordTipY - holderPos.y;
                const segLenSq = segDx * segDx + segDy * segDy;
                let t = ((targetPos.x - holderPos.x) * segDx + (targetPos.y - holderPos.y) * segDy) / segLenSq;
                t = Math.max(0, Math.min(1, t));
                const projX = holderPos.x + t * segDx;
                const projY = holderPos.y + t * segDy;

                const distToSwordSq = (targetPos.x - projX) ** 2 + (targetPos.y - projY) ** 2;
                const hitThreshold = (racerSize / 2 + this.width / 2);

                if (distToSwordSq <= hitThreshold * hitThreshold) {
                    this.onHitOtherRacer(world, closestRacer, racers);
                }
            }
        }
    }

    draw(ctx) {
        if (this.isSpawned && !this.holder) {
            // Draw on ground
            ctx.save();
            ctx.translate(this.spawnX, this.spawnY);
            if (this.image.complete && this.image.naturalWidth !== 0) {
                ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            } else {
                ctx.fillStyle = '#e67e22';
                ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            }
            ctx.restore();
        } else if (this.holder && this.angle !== undefined) {
            // Draw wielded by holder: offset at base of image (pivot at bottom of sword)
            const holderPos = this.holder.position;
            ctx.save();
            ctx.translate(holderPos.x, holderPos.y);
            ctx.rotate(this.angle + Math.PI / 2); // align vertical image pointing outwards
            if (this.image.complete && this.image.naturalWidth !== 0) {
                // Draw with bottom center of image at (0,0)
                ctx.drawImage(this.image, -this.width / 2, -this.height, this.width, this.height);
            } else {
                ctx.fillStyle = '#e67e22';
                ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
            }
            ctx.restore();
        }
    }
}

export class MonsterEnergyItem {
    constructor(spec = {}) {
        this.spawnX = spec.x ?? 540;
        this.spawnY = spec.y ?? 960;
        this.width = spec.width ?? 40;
        this.height = spec.height ?? 80;
        this.imageSrc = spec.imageSrc ?? './src/monsterenergy.png';
        this.boostDurationMs = spec.durationMs ?? 5000;
        this.boostMultiplier = spec.speedMultiplier ?? 2.0;
        this.respawnDelayMs = spec.respawnDelayMs ?? 5000;

        this.image = new Image();
        this.image.src = this.imageSrc;

        this.isSpawned = true;
        this.respawnTime = 0;

        this.pickupBody = Matter.Bodies.rectangle(this.spawnX, this.spawnY, this.width, this.height, {
            isStatic: true,
            isSensor: true,
            render: { visible: false }
        });
        this.pickupBody.weaponRef = this;
    }

    addToWorld(world) {
        Matter.World.add(world, this.pickupBody);
    }

    pickup(racer) {
        if (!this.isSpawned) return;
        this.isSpawned = false;
        this.respawnTime = Date.now() + this.respawnDelayMs;

        // Apply speed boost to racer for boostDurationMs (5 seconds)
        const baseSpeed = racer.baseSpeed ?? racer.targetSpeed;
        racer.baseSpeed = baseSpeed;
        racer.targetSpeed = baseSpeed * this.boostMultiplier;
        racer.boostEndTime = Date.now() + this.boostDurationMs;
    }

    update(racers, world) {
        const now = Date.now();
        if (!this.isSpawned && now >= this.respawnTime) {
            this.isSpawned = true;
        }
    }

    draw(ctx) {
        if (this.isSpawned) {
            ctx.save();
            ctx.translate(this.spawnX, this.spawnY);
            if (this.image.complete && this.image.naturalWidth !== 0) {
                ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            }
            ctx.restore();
        }
    }
}

export function setupBreakableCollisions(engine) {
    Matter.Events.on(engine, 'collisionStart', (event) => {
        let notePlayed = false;

        for (const pair of event.pairs) {
            const { bodyA, bodyB } = pair;

            // Handle portal collisions
            const checkPortal = (body1, body2) => {
                if (body1.portalRef && !body2.isStatic) {
                    const { portal, isEntrance } = body1.portalRef;
                    portal.teleport(body2, isEntrance);
                }
            };
            checkPortal(bodyA, bodyB);
            checkPortal(bodyB, bodyA);

            // Handle weapon / pickup collisions
            const checkWeapon = (body1, body2) => {
                if (body1.weaponRef && !body2.isStatic) {
                    body1.weaponRef.pickup(body2);
                }
            };
            checkWeapon(bodyA, bodyB);
            checkWeapon(bodyB, bodyA);

            if (!notePlayed && (!bodyA.isStatic || !bodyB.isStatic)) {
                playNextMelodyNote();
                notePlayed = true;
            }

            const handleHit = (obsBody, hitterBody) => {
                if (obsBody.obstacleRef && obsBody.obstacleRef instanceof BreakableObstacle && !hitterBody.isStatic) {
                    const obs = obsBody.obstacleRef;
                    if (obs instanceof ColorBreakableObstacle) {
                        if (hitterBody.colorKey === obs.requiredColor) {
                            obs.hit(engine.world);
                        }
                    } else {
                        obs.hit(engine.world);
                    }
                }
            };

            handleHit(bodyA, bodyB);
            handleHit(bodyB, bodyA);
        }
    });
}

export function drawBreakableObstacles(ctx, obstacles) {
    for (const obs of obstacles) {
        if (obs instanceof SwordWeapon || obs instanceof MonsterEnergyItem) {
            obs.draw(ctx);
        } else if (obs instanceof PortalObstacle) {
            // Draw entrance portal
            if (obs.image.complete && obs.image.naturalWidth !== 0) {
                ctx.drawImage(obs.image, obs.entrance.x - obs.width / 2, obs.entrance.y - obs.height / 2, obs.width, obs.height);
                ctx.drawImage(obs.image, obs.exit.x - obs.width / 2, obs.exit.y - obs.height / 2, obs.width, obs.height);
            } else {
                ctx.save();
                ctx.fillStyle = '#9b59b6';
                ctx.beginPath();
                ctx.arc(obs.entrance.x, obs.entrance.y, obs.width / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(obs.exit.x, obs.exit.y, obs.width / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        } else if (obs instanceof BreakableObstacle && !obs.isBroken) {
            if (obs instanceof ColorBreakableObstacle) continue;

            ctx.save();
            ctx.font = '900 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 16;
            ctx.lineJoin = 'miter';
            ctx.strokeText(obs.hitsLeft.toString(), obs.body.position.x, obs.body.position.y);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(obs.hitsLeft.toString(), obs.body.position.x, obs.body.position.y);
            ctx.restore();
        }
    }
}

export function createObstacles(world, field = {}) {
    const obstacles = [];

    // Static walls
    if (field.walls?.specs) {
        const wallColor = field.walls.color ?? '#24b96cff';
        for (const spec of field.walls.specs) {
            obstacles.push(new Obstacle(spec.x, spec.y, spec.w, spec.h, { fillStyle: wallColor }));
        }
    }

    // Breakable obstacles
    if (Array.isArray(field.breakableObstacles)) {
        for (const b of field.breakableObstacles) {
            obstacles.push(new BreakableObstacle(b.x, b.y, b.w, b.h, b.hits, { fillStyle: b.color }));
        }
    }

    // Dynamic Enemy obstacles
    if (Array.isArray(field.enemies)) {
        for (const e of field.enemies) {
            obstacles.push(new EnemyObstacle(e.x, e.y, e.w, e.h, e.hits ?? 50, {
                color: e.color ?? '#ff0055',
                speed: e.speed ?? 6,
                restitution: e.restitution,
                friction: e.friction,
                initialAngle: e.initialAngle
            }));
        }
    }

    // Color-keyed breakable bars
    const bars = field.colorBreakableBars;
    if (bars?.count && Array.isArray(bars.colorCycle)) {
        for (let i = 0; i < bars.count; i++) {
            const c = bars.colorCycle[i % bars.colorCycle.length];
            const y = bars.barStartY + i * bars.barHeight;
            obstacles.push(new ColorBreakableObstacle(bars.x, y, bars.width, bars.barHeight - 3, c.key, c.hex, bars.hits));
        }
    }

    // Portal
    if (field.portal?.entrance && field.portal?.exit) {
        const p = field.portal;
        const portal = new PortalObstacle(
            { x: p.entrance.x, y: p.entrance.y },
            { x: p.exit.x,     y: p.exit.y },
            { width: p.width,  height: p.height, cooldownMs: p.cooldownMs }
        );
        obstacles.push(portal);
    }

    // Weapons / Items
    if (Array.isArray(field.weapons)) {
        for (const wSpec of field.weapons) {
            if (wSpec.type === 'sword') {
                obstacles.push(new SwordWeapon(wSpec));
            } else if (wSpec.type === 'monsterenergy' || wSpec.type === 'monster') {
                obstacles.push(new MonsterEnergyItem(wSpec));
            }
        }
    }

    for (const obs of obstacles) {
        obs.addToWorld(world);
    }

    return obstacles;
}

export function drawStartAndEnd(ctx, field = {}) {
    const fz = field.finishZone;
    if (!fz?.x || !fz?.y) return;

    const finishX = fz.x;
    const finishY = fz.y;
    const finishWidth = fz.w ?? 200;
    const finishHeight = fz.h ?? 180;
    const tileSize = fz.tileSize ?? 40;

    const rows = Math.ceil(finishHeight / tileSize);
    const cols = Math.ceil(finishWidth / tileSize);

    ctx.save();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isBlack = (r + c) % 2 === 0;
            ctx.fillStyle = isBlack ? '#111116' : '#ffffff';
            const x = finishX + c * tileSize;
            const y = finishY + r * tileSize;
            const w = Math.min(tileSize, finishX + finishWidth - x);
            const h = Math.min(tileSize, finishY + finishHeight - y);
            ctx.fillRect(x, y, w, h);
        }
    }
    //ctx.restore();

    // ctx.strokeStyle = '#ffffff';
    // ctx.lineWidth = 4;
    // ctx.strokeRect(finishX, finishY, finishWidth, finishHeight);

    // ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    // ctx.fillRect(width / 2 - 240, height - 165, 480, 75);
    // ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    // ctx.lineWidth = 3;
    // ctx.strokeRect(width / 2 - 240, height - 165, 480, 75);

    // ctx.font = 'bold 48px sans-serif';
    // ctx.textAlign = 'center';

    // ctx.strokeStyle = '#000000';
    // ctx.lineWidth = 12;
    // ctx.lineJoin = 'miter';
    // ctx.fillStyle = '#ffffff';
    // ctx.fillText('FINISH LINE', width / 2, height - 110);
}

export class ClosingWall {
    constructor({
        startX,
        startY,
        endX,
        endY,
        thickness = 40,
        delayMs = 0,
        speed = 1.2,
        color = '#e53e3e'
    }) {
        // The wall grows from the start edge toward the end edge.
        // startX/startY = the fixed anchor edge position (center of the fixed edge)
        // endX/endY     = where the far edge will reach when fully grown
        // The wall is axis-aligned: horizontal grows left/right, vertical grows up/down.
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.thickness = thickness;
        this.delayMs = delayMs;
        this.speed = speed;

        // Determine growth axis
        this.growsHorizontal = Math.abs(endX - startX) >= Math.abs(endY - startY);

        // Current grown length (starts at 0, grows toward target)
        this.currentLength = 0;
        this.targetLength = this.growsHorizontal
            ? Math.abs(endX - startX)
            : Math.abs(endY - startY);

        this.startTime = Date.now() + delayMs;

        // Initial body size: start as a 1px sliver in the growth direction
        const initW = this.growsHorizontal ? 1 : thickness;
        const initH = this.growsHorizontal ? thickness : 1;
        this.body = Matter.Bodies.rectangle(startX, startY, initW, initH, {
            isStatic: true,
            restitution: 1.0,
            render: { fillStyle: color }
        });
    }

    addToWorld(world) {
        Matter.World.add(world, this.body);
    }

    update(racers, world) {
        if (Date.now() < this.startTime) return;

        if (this.currentLength < this.targetLength) {
            this.currentLength = Math.min(this.targetLength, this.currentLength + this.speed);

            const dx = this.endX - this.startX;
            const dy = this.endY - this.startY;

            let bodyW, bodyH, centerX, centerY;

            if (this.growsHorizontal) {
                bodyW = this.currentLength;
                bodyH = this.thickness;
                // Center is halfway between startX and the current leading edge
                const sign = dx >= 0 ? 1 : -1;
                centerX = this.startX + sign * this.currentLength / 2;
                centerY = this.startY;
            } else {
                bodyW = this.thickness;
                bodyH = this.currentLength;
                const sign = dy >= 0 ? 1 : -1;
                centerX = this.startX;
                centerY = this.startY + sign * this.currentLength / 2;
            }

            // Reshape and reposition the body
            const newVerts = Matter.Vertices.fromPath(
                `0 0 ${bodyW} 0 ${bodyW} ${bodyH} 0 ${bodyH}`
            );
            Matter.Body.setVertices(this.body, newVerts);
            Matter.Body.setPosition(this.body, { x: centerX, y: centerY });
        }

        // Elimination: kill racers fully overlapped by the grown wall
        const size = config.racers.size;
        const killThreshold = size * 0.6;

        for (let i = racers.length - 1; i >= 0; i--) {
            const racer = racers[i];
            const wallCollisions = Matter.Query.collides(racer, [this.body]);
            if (wallCollisions.length === 0) continue;

            const wallPos = this.body.position;
            const bounds = this.body.bounds;
            const wallHalfW = (bounds.max.x - bounds.min.x) / 2;
            const wallHalfH = (bounds.max.y - bounds.min.y) / 2;
            const racerHalf = size / 2;

            const overlapX = (wallHalfW + racerHalf) - Math.abs(racer.position.x - wallPos.x);
            const overlapY = (wallHalfH + racerHalf) - Math.abs(racer.position.y - wallPos.y);
            const minOverlap = Math.min(overlapX, overlapY);

            if (minOverlap >= killThreshold) {
                if (window.deathMarkers) {
                    window.deathMarkers.push({
                        x: racer.position.x,
                        y: racer.position.y,
                        size,
                        color: racer.render.fillStyle
                    });
                }
                if (window.confettiParticles) {
                    const particleCount = 180;
                    for (let p = 0; p < particleCount; p++) {
                        const angle = (Math.PI * 2 * p) / particleCount + (Math.random() - 0.5) * 0.4;
                        const speed = 3 + Math.random() * 16;
                        window.confettiParticles.push({
                            x: racer.position.x,
                            y: racer.position.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            size: 6 + Math.random() * 12,
                            color: racer.render.fillStyle,
                            alpha: 1.0,
                            rotation: Math.random() * Math.PI * 2,
                            vr: (Math.random() - 0.5) * 0.35
                        });
                    }
                }
                Matter.World.remove(world, racer);
                racers.splice(i, 1);
            }
        }
    }
}

export function createClosingWalls(world, field = {}) {
    if (!Array.isArray(field.closingWalls)) return [];
    const walls = field.closingWalls.map(cfg => new ClosingWall(cfg));
    walls.forEach(w => w.addToWorld(world));
    return walls;
}

export function updateClosingWalls(walls, racers, world) {
    for (const wall of walls) {
        wall.update(racers, world);
    }
}
