# 🟥 Short Form Square Race Simulation

A browser-based physics simulation designed for creating **short-form social media content** — think TikTok, Instagram Reels, and YouTube Shorts. Colored squares race through a fully customizable arena filled with hazards, pickups, teleporters, and closing walls, all recorded directly in-browser with synced audio.

---

## ✨ Features

- **Automatic Video Recording** — One-click start records the canvas + audio and auto-downloads the video file (MP4 or WebM via the `MediaRecorder` API)
- **Physics-Based Racing** — Squares bounce around a walled arena powered by rigid-body physics
- **Live Background Music** — Procedural piano melody plays in sync with collisions using the **Web Audio API**
- **Pickups**
  - 🗡️ **Sword** — Racer picks up a sword and attacks nearby opponents
  - ⚡ **Monster Energy** — Grants a temporary speed boost to the racer who grabs it
- **Teleporters (Portals)** — Portal pairs that teleport racers across the map with a cooldown
- **Breakable Obstacles** — Blocks that absorb a set number of hits before breaking
- **Color-Keyed Breakable Bars** — Bars that can only be broken by the racer of the matching color
- **Dynamic Enemy Obstacles** — Moving enemies that bounce around and take damage
- **Closing Walls** — Walls that grow in from the edges over time, shrinking the playfield and eliminating racers they engulf
- **Finish Zone** — Checkered finish line area; first racer to reach it wins
- **Field Editor via JSON** — All arena layouts are fully defined in `field.json` / the `fields/` folder — no code changes needed to design a new level
- **Follow Reminder Overlay** — Built-in "Remember to follow!" overlay for social media branding

---

## 🛠️ Libraries & APIs

| Library / API | Purpose |
|---|---|
| **[Matter.js](https://brm.io/matter-js/) v0.19** | 2D rigid-body physics engine — handles all collisions, forces, and body simulation |
| **Web Audio API** | Procedural piano melody generated in-browser; audio mixed into the recording stream |
| **Canvas API** | All rendering — racers, walls, obstacles, portals, finish zone, trails, confetti |
| **MediaRecorder API** | Captures the canvas + audio into a video file and triggers a download automatically |
| **MediaStream API** | Combines the canvas video stream and audio stream for recording |

All libraries are either native browser APIs or loaded via CDN — **no build step or npm install required**.

---

## 📁 Project Structure

```
square-race/
├── index.html              # Entry point
├── style.css               # UI styles
├── src/
│   ├── main.js             # Game loop, rendering, recording logic
│   ├── obstacles.js        # All obstacle classes + field parser
│   ├── racers.js           # Racer spawning & movement
│   ├── audio.js            # Web Audio melody engine
│   ├── arena.js            # Canvas/arena setup
│   ├── engine.js           # Matter.js engine initialization
│   ├── config.js           # Shared config constants
│   ├── instagram.js        # Social overlay rendering
│   └── field.json          # Active arena layout
├── fields/                 # Saved arena presets
│   ├── netherportal1.json
│   ├── trashcompactorsword.json
│   ├── twoswords.json
│   └── zogzagswords.json
└── videos/                 # Example recorded outputs
```

---

## 🚀 Getting Started

No installation needed. Just open `index.html` in a modern browser (Chrome recommended for best `MediaRecorder` support).

1. Open `index.html` in Chrome
2. Click **START RACE**
3. The race runs and records automatically
4. When the race ends, the video downloads to your machine

---

## 🗺️ Customizing the Arena (`field.json`)

All arena elements are configured in `src/field.json`. Swap it with any file from `fields/` or create your own.

### Top-level keys

| Key | Description |
|---|---|
| `arena` | Canvas width & height |
| `racers` | Speed, size, physics props, colors, spawn points |
| `walls` | Static wall specs (x, y, w, h) and color |
| `breakableObstacles` | Blocks with a hit count before they break |
| `enemies` | Dynamic bouncing enemy obstacles |
| `colorBreakableBars` | Grid of bars each requiring a specific racer color to break |
| `portal` | Entrance/exit teleporter pair |
| `weapons` | Pickups — `"type": "sword"` or `"type": "monsterenergy"` |
| `finishZone` | Checkered finish area position and size |
| `closingWalls` | Walls that grow in over time, with delay and speed |

---

## 📸 Content Tips

- **9:16 aspect ratio** (1080×1920) — native vertical short-form format
- Record multiple runs and pick the best for posting
- Adjust `closingWalls` delays to control pacing and tension
- Use `fields/` presets to quickly switch between arena styles between recordings
