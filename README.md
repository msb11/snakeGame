# 🐍 SNAKO-SNAKI — Ultimate Snake Game

> A fully-featured, modern remake of the classic Snake game built with **vanilla HTML5, CSS3, and JavaScript** — no frameworks, no dependencies.


---

## 🎮 Features

### Core Gameplay
- **25×25 grid** rendered on an HTML5 Canvas for smooth, performant animation
- Classic snake movement with collision detection (walls, self, obstacles)
- Real-time score, level, and hi-score tracking via `localStorage`

### 🍎 Multiple Food Types
| Food | Points | Effect |
|------|--------|--------|
| 🔴 Normal | +1 | Grows snake by 1 segment |
| ⭐ Bonus | +5 | Grows snake by 3 segments, expires in 8s |
| ☠️ Poison | −2 | Shrinks snake by 3 segments |
| ⚡ Power-up | — | Activates a random power-up |

### ⚡ Power-Ups
- **👻 Ghost Mode** — Pass through yourself for 6 seconds
- **🐢 Slow Motion** — Speed halved for 6 seconds
- **✨ Double Score** — All positive food worth 2× for 6 seconds

### 📈 Level & Difficulty System
- **10 levels**, each triggered by reaching a score threshold (`level × 5`)
- Speed increases with every level (`5 + (level−1) × 1.2` ticks/sec)
- Obstacles increase per level (up to 16 paired wall blocks)
- Level-up plays a fanfare sound and flashes the HUD

### 🎨 Theme System
| Theme | Description |
|-------|-------------|
| ⚡ Neon | Cyan & purple glow (default) |
| 👾 Retro | Orange & yellow on dark brown |
| 🌑 Dark | Monochrome grayscale |
| 🌸 Pastel | Soft pinks and purples |

Theme preference is **saved across sessions** via `localStorage`.

### 💾 Save & Load
- Full game state persisted to `localStorage`
- Includes: snake position, score, level, food, obstacles, direction, speed
- Accessible from the pause menu or keyboard shortcuts

### 📱 Mobile Support
- On-screen **D-pad** controls (auto-shown on touch devices)
- **Swipe gestures** directly on the canvas
- Responsive layout that fits any screen size

---

## 🕹️ Controls

### Keyboard
| Key | Action |
|-----|--------|
| `↑ ↓ ← →` | Move snake |
| `W A S D` | Move snake (alternative) |
| `Space` | Pause / Resume |
| `M` | Mute / Unmute |
| `Ctrl + S` | Save game |
| `L` | Load game |

### Mobile
- Tap **D-pad** buttons below the board
- **Swipe** on the board in any direction

---

## 🚀 Getting Started

No build tools or installation required.

```bash
# Clone or download the project
git clone https://github.com/yourname/snako-snaki.git
cd snako-snaki

# Open in browser (any local server works)
npx serve .
# or just open index.html directly in your browser
```

### File Structure
```
snako-snaki/
├── index.html      # Game layout, overlays, HUD, mobile controls
├── style.css       # Themes, animations, responsive layout
├── script.js       # Full game engine (18 sections, modular)
└── README.md
```

---

## 🏗️ Architecture

The game is organized into **18 modular sections** inside `script.js`:

| Section | Responsibility |
|---------|---------------|
| 1 | Canvas setup & constants |
| 2 | Game state object |
| 3 | Audio engine (Web Audio API — no files needed) |
| 4 | Theme system |
| 5 | Level & difficulty logic |
| 6 | Obstacle generation |
| 7 | Food spawn & expiry |
| 8 | Power-up activation & timers |
| 9 | Collision detection |
| 10 | Main game loop (`requestAnimationFrame`) |
| 11 | Canvas rendering (snake, food, obstacles, grid) |
| 12 | HUD updates & animations |
| 13 | Game lifecycle (start, pause, game over) |
| 14 | Save / Load (`localStorage`) |
| 15 | Input handling (keyboard + touch + swipe) |
| 16 | UI button wiring |
| 17 | Utilities |
| 18 | Initialization |

---

## 🔊 Audio

All sounds are **synthesized at runtime** using the Web Audio API — no MP3 files needed. Sounds include: eat, bonus eat, poison, move, game over, level-up, power-up, and pause.

Sound can be toggled with the `🔊` button (top right) or by pressing `M`.

---


## 🤝 Contributing

Pull requests welcome! Some ideas for future additions:
- Multiplayer via WebSockets
- Leaderboard (backend or Firebase)
- Additional themes
- Snake skin customization

---


