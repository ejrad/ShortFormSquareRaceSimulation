import { config } from './config.js';
import { setupEngine } from './engine.js';
import { createArena } from './arena.js';
import { initAudio, getAudioStream, playNextMelodyNote } from './audio.js';
import { spawnRacers, updateRacers } from './racers.js';
import { createObstacles, drawStartAndEnd, setupBreakableCollisions, drawBreakableObstacles, createClosingWalls, updateClosingWalls, SwordWeapon } from './obstacles.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

window.deathMarkers = [];
window.confettiParticles = [];

export function triggerDeathConfetti(x, y, color) {
    const particleCount = 180;
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const speed = 3 + Math.random() * 16;
        window.confettiParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 6 + Math.random() * 12,
            color,
            alpha: 1.0,
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.35
        });
    }
}

// Finish zone and podium state — populated after field loads
let FINISH = null;
const finishers = [];
const PLACE_PREFIXES = ['WINNER:', '2nd:', '3rd:'];

let engine, obstacles, racers, closingWalls, field;

(async () => {
    field = await fetch('./src/field.json').then(r => r.json());

    engine = setupEngine();
    createArena(engine.world);
    obstacles = createObstacles(engine.world, field);
    setupBreakableCollisions(engine);
    racers = spawnRacers(engine.world, field);
    closingWalls = createClosingWalls(engine.world, field);

    FINISH = field.finishZone;

    render();
})();

let raceStarted = false;

let mediaRecorder = null;
let recordedChunks = [];

function startCanvasRecording() {
    try {
        initAudio();
        // Play starting note at exact moment recording starts
        playNextMelodyNote();
        const videoStream = canvas.captureStream(60);
        const audioStream = getAudioStream();
        const tracks = [...videoStream.getVideoTracks()];
        if (audioStream) {
            tracks.push(...audioStream.getAudioTracks());
        }
        const combinedStream = new MediaStream(tracks);
        const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
            ? 'video/mp4;codecs=avc1'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `square-race.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
        };
        mediaRecorder.start();
    } catch (err) {
        console.warn('MediaRecorder not supported or blocked:', err);
    }
}

const startRaceBtn = document.getElementById('startRaceBtn');
startRaceBtn.addEventListener('click', () => {
    startRaceBtn.style.display = 'none';

    startCanvasRecording();

    const followReminder = document.getElementById('followReminder');
    setTimeout(() => {
        followReminder.classList.add('visible');
        setTimeout(() => {
            followReminder.classList.remove('visible');
            followReminder.classList.add('hiding');
        }, 5000);
    }, 5000);

    setTimeout(() => {
        raceStarted = true;

        for (const racer of racers) {
            Matter.Body.setVelocity(racer, {
                x: Math.cos(racer.initialAngle) * racer.targetSpeed,
                y: Math.sin(racer.initialAngle) * racer.targetSpeed
            });
        }

        for (const wall of closingWalls) {
            wall.startTime = Date.now() + wall.delayMs;
        }
    }, 1000);
});

const paperImg = new Image();
paperImg.src = './src/paper.png';

// Custom render loop
function render() {
    requestAnimationFrame(render); // always schedule next frame first
    try {
    if (raceStarted) {
        updateRacers(racers);
        updateClosingWalls(closingWalls, racers, engine.world);

        for (const obs of obstacles) {
            if (typeof obs.update === 'function' && obs.pickupBody) {
                obs.update(racers, engine.world);
            }
        }

        // Check for finish zone crossings
        if (FINISH?.x !== undefined && FINISH?.y !== undefined) {
            for (let i = racers.length - 1; i >= 0; i--) {
                const racer = racers[i];
                const pos = racer.position;
                if (
                    pos.x >= FINISH.x && pos.x <= FINISH.x + (FINISH.w ?? 200) &&
                    pos.y >= FINISH.y && pos.y <= FINISH.y + (FINISH.h ?? 180)
                ) {
                    finishers.push({ color: racer.render.fillStyle, name: racer.colorKey });
                    Matter.World.remove(engine.world, racer);
                    racers.splice(i, 1);

                    // Kill ALL remaining racers when 3rd place finishes
                    if (finishers.length === 3 && racers.length > 0) {
                        for (let k = racers.length - 1; k >= 0; k--) {
                            const dead = racers[k];
                            window.deathMarkers.push({
                                x: dead.position.x,
                                y: dead.position.y,
                                size: config.racers.size,
                                color: dead.render.fillStyle
                            });
                            triggerDeathConfetti(dead.position.x, dead.position.y, dead.render.fillStyle);
                            Matter.World.remove(engine.world, dead);
                            racers.splice(k, 1);
                        }

                        // Stop recording 2 seconds after race finishes to save video file
                        setTimeout(() => {
                            if (mediaRecorder && mediaRecorder.state === 'recording') {
                                mediaRecorder.requestData();
                                mediaRecorder.stop();
                            }
                        }, 2000);
                    }
                }
            }
        }

        // Last man standing: if only 1 racer remains alive and race isn't already over
        if (racers.length === 1 && finishers.length < 3 && !window.lastManStandingWon) {
            window.lastManStandingWon = true;
            const survivor = racers[0];
            finishers.push({ color: survivor.render.fillStyle, name: survivor.colorKey });

            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.requestData();
                    mediaRecorder.stop();
                }
            }, 2000);
        }
    }

    // Clear canvas / Draw background
    if (paperImg.complete && paperImg.naturalWidth !== 0) {
        ctx.drawImage(paperImg, 0, 0, config.arena.width, config.arena.height);
    } else {
        ctx.fillStyle = '#0f0f13';
        ctx.fillRect(0, 0, config.arena.width, config.arena.height);
    }

    drawStartAndEnd(ctx, field);

    // Draw racer trails (tapering size and fading opacity)
    for (const racer of racers) {
        if (racer.trail && racer.trail.length > 1) {
            const total = racer.trail.length;
            const maxSize = config.racers.size * 0.7;

            for (let i = 0; i < total - 1; i++) {
                const p1 = racer.trail[i];
                const p2 = racer.trail[i + 1];
                const progress = i / (total - 1);

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);

                ctx.strokeStyle = racer.render.fillStyle;
                ctx.lineWidth = maxSize * progress;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = progress * 0.3;
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        }
    }

    // Draw all bodies
    const bodies = Matter.Composite.allBodies(engine.world);
    const closingWallBodies = new Set(closingWalls.map(w => w.body));
    const staticBodies = bodies.filter(b => b.isStatic && !b.isSensor && b.render?.visible !== false && !closingWallBodies.has(b));
    const dynamicBodies = bodies.filter(b => !b.isStatic);

    // Pass 0: Draw closing wall bodies BEHIND everything else
    ctx.save();
    for (const wall of closingWalls) {
        const body = wall.body;
        ctx.beginPath();
        const verts = body.vertices;
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let j = 1; j < verts.length; j++) ctx.lineTo(verts[j].x, verts[j].y);
        ctx.closePath();
        ctx.fillStyle = body.render.fillStyle || '#cc0000';
        ctx.fill();
    }
    ctx.restore();

    // Pass 1: Outer stroke for static walls (covers outer perimeter)
    ctx.save();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.lineJoin = 'miter';
    for (const body of staticBodies) {
        ctx.beginPath();
        const vertices = body.vertices;
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Pass 2: Fill static walls (covers inner strokes, leaving clean outer border)
    for (const body of staticBodies) {
        ctx.beginPath();
        const vertices = body.vertices;
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.closePath();
        ctx.fillStyle = body.render.fillStyle || '#ffffff';
        ctx.fill();
    }
    ctx.restore();

    // Draw dynamic bodies (racers)
    for (const body of dynamicBodies) {
        ctx.beginPath();
        const vertices = body.vertices;

        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.closePath();

        ctx.fillStyle = body.render.fillStyle || '#ffffff';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Draw cute square eyes at identical Y level facing movement direction
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        const len = Math.hypot(vx, vy) || 1;
        const dirX = vx / len;
        const dirY = vy / len;

        // Calculate actual body width dynamically from bounds so eye proportions scale when size changes
        const bounds = body.bounds;
        const size = (bounds.max.x - bounds.min.x) || (field?.racers?.size ?? config.racers.size);

        const eyeSpacing = size * 0.25;
        const eyeWidth = size * 0.35;
        const eyeHeight = size * 0.50;
        const pupilWidth = size * 0.18;
        const pupilHeight = size * 0.26;
        const pupilOffsetMax = size * 0.05; // scaled look displacement

        // Keep eyes aligned on same horizontal Y axis relative to body center
        const eyeY = body.position.y - size * 0.05;
        const eye1X = body.position.x - eyeSpacing;
        const eye2X = body.position.x + eyeSpacing;

        ctx.lineWidth = Math.max(1, size * 0.033);
        ctx.strokeStyle = '#000000';

        const pupilLeftX = eye1X - pupilWidth / 2 + dirX * pupilOffsetMax;
        const pupilLeftY = eyeY - pupilHeight / 2 + dirY * pupilOffsetMax;
        const pupilRightX = eye2X - pupilWidth / 2 + dirX * pupilOffsetMax;
        const pupilRightY = eyeY - pupilHeight / 2 + dirY * pupilOffsetMax;
        const shineSize = Math.max(1.5, size * 0.05);

        // Left Eye
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(eye1X - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.strokeRect(eye1X - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(pupilLeftX, pupilLeftY, pupilWidth, pupilHeight);
        // Left Eye Cute Shine Highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pupilLeftX + pupilWidth * 0.55, pupilLeftY + pupilHeight * 0.15, shineSize, shineSize);

        // Right Eye
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(eye2X - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.strokeRect(eye2X - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(pupilRightX, pupilRightY, pupilWidth, pupilHeight);
        // Right Eye Cute Shine Highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pupilRightX + pupilWidth * 0.55, pupilRightY + pupilHeight * 0.15, shineSize, shineSize);
    }

    drawBreakableObstacles(ctx, obstacles);

    // Render death markers (desaturated square with X's on eyes)
    for (const marker of window.deathMarkers) {
        ctx.save();
        ctx.translate(marker.x, marker.y);

        // Desaturated fill color
        ctx.fillStyle = marker.color;
        ctx.filter = 'grayscale(70%) opacity(0.8)';
        ctx.fillRect(-marker.size / 2, -marker.size / 2, marker.size, marker.size);

        ctx.filter = 'none';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(-marker.size / 2, -marker.size / 2, marker.size, marker.size);

        // X's on eyes
        const eyeSpacing = marker.size * 0.25;
        const eyeWidth = marker.size * 0.35;
        const eyeHeight = marker.size * 0.50;
        const eyeY = -marker.size * 0.05;

        const eyeXs = [-eyeSpacing, eyeSpacing];
        for (const ex of eyeXs) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ex - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
            ctx.strokeRect(ex - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight);

            // Draw X in eye
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000000';
            ctx.beginPath();
            const armX = eyeWidth * 0.35;
            const armY = eyeHeight * 0.35;
            ctx.moveTo(ex - armX, eyeY - armY);
            ctx.lineTo(ex + armX, eyeY + armY);
            ctx.moveTo(ex + armX, eyeY - armY);
            ctx.lineTo(ex - armX, eyeY + armY);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Render & update spherical confetti particle explosion
    for (let i = window.confettiParticles.length - 1; i >= 0; i--) {
        const p = window.confettiParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy += 0.15; // subtle gravity drift
        p.rotation += p.vr;
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
            window.confettiParticles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
    }

    // Draw podium text
    if (finishers.length > 0) {
        ctx.save();
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'miter';

        const cx = config.arena.width / 2;
        // Start near middle of screen (e.g. y = 720) so WINNER is centered
        let y = 720;

        const drawText = (text, x, currentY, fontSize, fillColor, align = 'left') => {
            ctx.font = `900 ${fontSize}px sans-serif`;
            ctx.textAlign = align;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            // White outer stroke
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = fontSize * 0.32;
            ctx.strokeText(text, x, currentY);
            // Black inner stroke
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = fontSize * 0.14;
            ctx.strokeText(text, x, currentY);
            // Fill
            ctx.fillStyle = fillColor;
            ctx.fillText(text, x, currentY);
        };

        for (let fi = 0; fi < finishers.length; fi++) {
            const f = finishers[fi];
            const prefix = PLACE_PREFIXES[fi] ?? `${fi + 1}th:`;
            const name = f.name.toUpperCase();

            if (fi === 0) {
                // Winner: two lines, large, vertically centered
                const fontSize = 90;
                drawText(prefix, cx, y, fontSize, '#ffffff', 'center');
                y += fontSize + 6;
                drawText(name, cx, y, fontSize, f.color, 'center');
                y += fontSize + 24;
            } else {
                // 2nd / 3rd: prefix + color name on the same line, side by side, centered together
                const fontSize = 62;
                ctx.font = `900 ${fontSize}px sans-serif`;
                const prefixStr = prefix + ' ';
                const prefixW = ctx.measureText(prefixStr).width;
                const nameW = ctx.measureText(name).width;
                const startX = cx - (prefixW + nameW) / 2;

                drawText(prefixStr, startX, y, fontSize, '#ffffff');
                drawText(name, startX + prefixW, y, fontSize, f.color);
                y += fontSize + 14;
            }
        }
        ctx.restore();
    }

    } catch (e) {
        console.error('Render error:', e);
    }
}
