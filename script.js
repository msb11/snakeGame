const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const COLS = 25, ROWS = 25;
const CELL = canvas.width / COLS; // 20px per cell

let state = {
    snake: [{ x: 12, y: 12 }],
    inputDir: { x: 0, y: 0 },
    pendingDir: null,          
    food: [],                  
    obstacles: [],             
    score: 0,
    level: 1,
    speed: 5,
    lastPaintTime: 0,
    paused: false,
    gameStarted: false,
    gameOver: false,
    soundOn: true,
    ghostMode: false,           
    slowMode: false,            
    doubleScore: false,         
    powerupTimers: {},          
    growthQueue: 0,            
    hiscore: 0,
    theme: 'neon',
    animFrame: null,
};


const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq, duration, type = 'square', vol = 0.15) {
    if (!state.soundOn) return;
    try {
        ensureAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* silent fail */ }
}

const Sounds = {
    eat:      () => beep(880, 0.08, 'sine', 0.2),
    bonus:    () => { beep(660, 0.08); setTimeout(() => beep(880, 0.1), 80); },
    poison:   () => beep(200, 0.2, 'sawtooth', 0.15),
    move:     () => beep(440, 0.03, 'square', 0.05),
    gameOver: () => { beep(300, 0.15); setTimeout(() => beep(200, 0.2), 160); setTimeout(() => beep(100, 0.4), 340); },
    levelUp:  () => { beep(440, 0.08); setTimeout(() => beep(550, 0.08), 90); setTimeout(() => beep(660, 0.15), 180); },
    powerup:  () => { beep(600, 0.06, 'sine'); setTimeout(() => beep(800, 0.06, 'sine'), 70); setTimeout(() => beep(1000, 0.12, 'sine'), 140); },
    pause:    () => beep(330, 0.1, 'triangle', 0.1),
};


const THEMES = {
    neon: {
        board: '#0a0a1a',
        snakeHead: '#00ffff',
        snakeBody: (i, len) => `hsl(${270 + i * 10}, 80%, 55%)`,
        snakeBorder: '#ffffff22',
        obstacle: '#3a3a6a',
        obstacleStroke: '#7b2fff',
        gridLine: '#ffffff05',
    },
    retro: {
        board: '#1a1000',
        snakeHead: '#ffff00',
        snakeBody: (i) => `hsl(${30 + i * 5}, 90%, 50%)`,
        snakeBorder: '#ffffff33',
        obstacle: '#4a2800',
        obstacleStroke: '#ff8800',
        gridLine: '#ffffff06',
    },
    dark: {
        board: '#111',
        snakeHead: '#fff',
        snakeBody: (i) => `hsl(0, 0%, ${60 - i * 3}%)`,
        snakeBorder: '#ffffff11',
        obstacle: '#2a2a2a',
        obstacleStroke: '#555',
        gridLine: '#ffffff04',
    },
    pastel: {
        board: '#fff5f8',
        snakeHead: '#ba68c8',
        snakeBody: (i) => `hsl(${330 - i * 8}, 60%, 75%)`,
        snakeBorder: '#ce93d822',
        obstacle: '#e8c5d5',
        obstacleStroke: '#f48fb1',
        gridLine: '#00000006',
    },
};

const FOOD_STYLES = {
    neon:   { normal: '#ff4466', bonus: '#ffcc00', poison: '#44ff66', powerup: '#ff88ff' },
    retro:  { normal: '#ff4400', bonus: '#ffff00', poison: '#00ff88', powerup: '#ff88ff' },
    dark:   { normal: '#ff4466', bonus: '#ffcc00', poison: '#44ff66', powerup: '#aaaaaa' },
    pastel: { normal: '#ef9a9a', bonus: '#fff176', poison: '#a5d6a7', powerup: '#ce93d8' },
};


function getLevelData(level) {
    // Each level: thresholds, speed, obstacle count
    return {
        speedBase: 5 + (level - 1) * 1.2,
        obstacleCount: Math.min((level - 1) * 2, 16),
        scoreToNext: level * 5,
    };
}

function checkLevelUp() {
    const ld = getLevelData(state.level);
    if (state.score >= ld.scoreToNext && state.level < 10) {
        state.level++;
        const newLd = getLevelData(state.level);
        state.speed = state.slowMode ? newLd.speedBase * 0.5 : newLd.speedBase;
        generateObstacles();
        Sounds.levelUp();
        flashHud('levelBox');
        updateHUD();
    }
}


function generateObstacles() {
    const count = getLevelData(state.level).obstacleCount;
    state.obstacles = [];
    const safeZone = (pos) => {
        // Keep center clear for snake spawn
        const dx = pos.x - 12, dy = pos.y - 12;
        return Math.abs(dx) < 4 && Math.abs(dy) < 4;
    };
    let attempts = 0;
    while (state.obstacles.length < count && attempts < 500) {
        attempts++;
        const pos = { x: rand(1, COLS - 2), y: rand(1, ROWS - 2) };
        if (safeZone(pos)) continue;
        if (state.obstacles.some(o => o.x === pos.x && o.y === pos.y)) continue;
        // Obstacles come in pairs (short walls)
        state.obstacles.push(pos);
        if (state.obstacles.length < count) {
            const pair = Math.random() < 0.5
                ? { x: pos.x + 1, y: pos.y }
                : { x: pos.x, y: pos.y + 1 };
            if (pair.x > 0 && pair.x < COLS - 1 && pair.y > 0 && pair.y < ROWS - 1 && !safeZone(pair)) {
                state.obstacles.push(pair);
            }
        }
    }
}

// Food types: normal, bonus, poison, powerup
const FOOD_CONFIG = {
    normal:  { chance: 0.65, score: 1,  emoji: '🔴', duration: null },
    bonus:   { chance: 0.15, score: 5,  emoji: '⭐', duration: 8000 },
    poison:  { chance: 0.12, score: -2, emoji: '☠️', duration: null },
    powerup: { chance: 0.08, score: 0,  emoji: '⚡', duration: 6000 },
};

function spawnFood() {
    // Keep max 3 food items on board
    while (state.food.length < 3) {
        const type = pickFoodType();
        const pos = randomFreeCell();
        if (!pos) break;
        const item = { x: pos.x, y: pos.y, type, spawnTime: Date.now() };
        // Bonus & powerup foods expire
        if (FOOD_CONFIG[type].duration) {
            item.expiry = Date.now() + FOOD_CONFIG[type].duration;
        }
        state.food.push(item);
    }
}

function pickFoodType() {
    const r = Math.random();
    let cumulative = 0;
    for (const [type, cfg] of Object.entries(FOOD_CONFIG)) {
        cumulative += cfg.chance;
        if (r < cumulative) return type;
    }
    return 'normal';
}

function expireFood(now) {
    state.food = state.food.filter(f => !f.expiry || f.expiry > now);
}

function randomFreeCell() {
    const used = new Set([
        ...state.snake.map(s => `${s.x},${s.y}`),
        ...state.obstacles.map(o => `${o.x},${o.y}`),
        ...state.food.map(f => `${f.x},${f.y}`),
    ]);
    let attempts = 0;
    while (attempts++ < 200) {
        const pos = { x: rand(1, COLS - 2), y: rand(1, ROWS - 2) };
        if (!used.has(`${pos.x},${pos.y}`)) return pos;
    }
    return null;
}

const POWERUP_TYPES = ['ghost', 'slow', 'double'];

function activatePowerup() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const DURATION = 6000;

    clearPowerup(type);
    Sounds.powerup();

    switch (type) {
        case 'ghost':
            state.ghostMode = true;
            showPowerupBanner('👻 GHOST MODE', DURATION);
            state.powerupTimers.ghost = setTimeout(() => {
                state.ghostMode = false;
                updatePowerupDisplay();
            }, DURATION);
            break;
        case 'slow':
            state.slowMode = true;
            state.speed = getLevelData(state.level).speedBase * 0.5;
            showPowerupBanner('🐢 SLOW MOTION', DURATION);
            state.powerupTimers.slow = setTimeout(() => {
                state.slowMode = false;
                state.speed = getLevelData(state.level).speedBase;
                updatePowerupDisplay();
            }, DURATION);
            break;
        case 'double':
            state.doubleScore = true;
            showPowerupBanner('✨ DOUBLE SCORE', DURATION);
            state.powerupTimers.double = setTimeout(() => {
                state.doubleScore = false;
                updatePowerupDisplay();
            }, DURATION);
            break;
    }
    updatePowerupDisplay();
}

function clearPowerup(type) {
    if (state.powerupTimers[type]) {
        clearTimeout(state.powerupTimers[type]);
        delete state.powerupTimers[type];
    }
}

function clearAllPowerups() {
    ['ghost', 'slow', 'double'].forEach(clearPowerup);
    state.ghostMode = false;
    state.slowMode = false;
    state.doubleScore = false;
    updatePowerupDisplay();
}

let powerupBannerTimer = null;
function showPowerupBanner(text, duration) {
    const el = document.getElementById('powerupDisplay');
    if (powerupBannerTimer) clearTimeout(powerupBannerTimer);
    el.textContent = text;
    powerupBannerTimer = setTimeout(() => {
        if (!state.ghostMode && !state.slowMode && !state.doubleScore)
            el.textContent = '';
    }, duration);
}

function updatePowerupDisplay() {
    const el = document.getElementById('powerupDisplay');
    const active = [];
    if (state.ghostMode) active.push('👻 GHOST');
    if (state.slowMode) active.push('🐢 SLOW');
    if (state.doubleScore) active.push('✨ ×2');
    el.textContent = active.join('  ');
}

function isCollide() {
    const head = state.snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return true;

    // Obstacle collision
    if (state.obstacles.some(o => o.x === head.x && o.y === head.y)) return true;

    // Self collision (skip if ghost mode active)
    if (!state.ghostMode) {
        for (let i = 1; i < state.snake.length; i++) {
            if (state.snake[i].x === head.x && state.snake[i].y === head.y) return true;
        }
    }

    return false;
}

function gameEngine(ctime) {
    state.animFrame = window.requestAnimationFrame(gameEngine);

    if (state.paused || state.gameOver || !state.gameStarted) {
        drawBoard(); // Still render in paused state
        return;
    }

    const effectiveSpeed = state.speed;
    if ((ctime - state.lastPaintTime) / 1000 < 1 / effectiveSpeed) return;
    state.lastPaintTime = ctime;

    // Apply buffered direction (reverse-prevention happens at input)
    if (state.pendingDir) {
        state.inputDir = state.pendingDir;
        state.pendingDir = null;
    }

    // Don't move if game hasn't started (inputDir = 0,0)
    if (state.inputDir.x === 0 && state.inputDir.y === 0) {
        drawBoard();
        return;
    }

    // Move snake: shift body, update head
    const newHead = {
        x: state.snake[0].x + state.inputDir.x,
        y: state.snake[0].y + state.inputDir.y,
    };

    state.snake.unshift(newHead);

    // Handle growth queue (smooth growth)
    if (state.growthQueue > 0) {
        state.growthQueue--;
        // Don't pop tail — snake grows
    } else {
        state.snake.pop();
    }

    // Collision check
    if (isCollide()) {
        triggerGameOver();
        return;
    }

    // Food collision
    const now = Date.now();
    expireFood(now);

    for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i];
        if (f.x === newHead.x && f.y === newHead.y) {
            handleFoodEaten(f);
            state.food.splice(i, 1);
        }
    }

    spawnFood();
    checkLevelUp();
    drawBoard();
}

function handleFoodEaten(food) {
    const cfg = FOOD_CONFIG[food.type];
    let pts = cfg.score;

    if (food.type === 'powerup') {
        activatePowerup();
    } else {
        if (state.doubleScore && pts > 0) pts *= 2;
        state.score = Math.max(0, state.score + pts);

        // Growth: normal = +1 segment, bonus = +3
        if (pts > 0) {
            state.growthQueue += food.type === 'bonus' ? 3 : 1;
            Sounds.eat();
            if (food.type === 'bonus') Sounds.bonus();
        } else {
            // Poison: shrink snake
            Sounds.poison();
            const shrink = Math.min(3, state.snake.length - 1);
            for (let i = 0; i < shrink; i++) state.snake.pop();
        }
    }

    // Update hi-score
    if (state.score > state.hiscore) {
        state.hiscore = state.score;
        localStorage.setItem('snako_hiscore', state.hiscore);
    }

    updateHUD();
}


function drawBoard() {
    const T = THEMES[state.theme];
    const FS = FOOD_STYLES[state.theme];
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = T.board;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = T.gridLine;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
        ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(W, j * CELL); ctx.stroke();
    }

    // Obstacles
    state.obstacles.forEach(o => {
        const x = o.x * CELL, y = o.y * CELL;
        ctx.fillStyle = T.obstacle;
        roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 3);
        ctx.fill();
        ctx.strokeStyle = T.obstacleStroke;
        ctx.lineWidth = 1;
        roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 3);
        ctx.stroke();
    });

    // Food
    state.food.forEach(f => {
        const x = f.x * CELL + CELL / 2, y = f.y * CELL + CELL / 2;
        const r = CELL * 0.38;
        const color = FS[f.type];

        // Pulsing ring for bonus/powerup
        if (f.type === 'bonus' || f.type === 'powerup') {
            const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
            ctx.beginPath();
            ctx.arc(x, y, r * 1.5 * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = color + '66';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Expiry flash for timed foods
        if (f.expiry) {
            const remaining = f.expiry - Date.now();
            if (remaining < 2000 && Math.floor(Date.now() / 200) % 2 === 0) return; // blink
        }

        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        grad.addColorStop(0, '#ffffff88');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, color + 'cc');

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Poison skull mark
        if (f.type === 'poison') {
            ctx.fillStyle = '#00000066';
            ctx.font = `${CELL * 0.55}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('☠', x, y + 1);
        }
        if (f.type === 'powerup') {
            ctx.fillStyle = '#ffffffcc';
            ctx.font = `${CELL * 0.5}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', x, y + 1);
        }
    });

    // Snake
    const ghostAlpha = state.ghostMode ? 0.5 : 1;
    ctx.globalAlpha = ghostAlpha;

    state.snake.forEach((seg, i) => {
        const x = seg.x * CELL, y = seg.y * CELL;
        const pad = i === 0 ? 0 : 1;

        if (i === 0) {
            // Head — gradient + glow
            const grd = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
            grd.addColorStop(0, '#ffffff');
            grd.addColorStop(1, T.snakeHead);
            ctx.fillStyle = grd;
            roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, 6);
            ctx.fill();
            // Eyes
            drawSnakeEyes(seg, i);
        } else {
            ctx.fillStyle = typeof T.snakeBody === 'function'
                ? T.snakeBody(i, state.snake.length)
                : T.snakeBody;
            roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, 4);
            ctx.fill();
        }
    });

    ctx.globalAlpha = 1;
}

function drawSnakeEyes(head) {
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const dir = state.inputDir;

    // Perpendicular offset
    const perp = { x: dir.y, y: -dir.x };
    const eyeR = CELL * 0.1;
    const eyeOffset = CELL * 0.22;
    const eyeFwd = CELL * 0.12;

    [-1, 1].forEach(side => {
        const ex = cx + perp.x * eyeOffset * side + dir.x * eyeFwd;
        const ey = cy + perp.y * eyeOffset * side + dir.y * eyeFwd;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + eyeR * 0.3, ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}


function updateHUD() {
    document.getElementById('scoreBox').textContent = state.score;
    document.getElementById('levelBox').textContent = state.level;
    document.getElementById('hiscoreBox').textContent = state.hiscore;
}

function flashHud(id) {
    const el = document.getElementById(id);
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
}

function startGame() {
    state.snake = [{ x: 12, y: 12 }];
    state.inputDir = { x: 0, y: 0 };
    state.pendingDir = null;
    state.food = [];
    state.score = 0;
    state.level = 1;
    state.speed = getLevelData(1).speedBase;
    state.paused = false;
    state.gameOver = false;
    state.gameStarted = true;
    state.growthQueue = 0;
    clearAllPowerups();
    generateObstacles();
    spawnFood();
    updateHUD();
    hide('startScreen');
    hide('gameOverScreen');
    hide('pauseScreen');
}

function triggerGameOver() {
    state.gameOver = true;
    Sounds.gameOver();
    drawBoard();

    const isNewHi = state.score >= state.hiscore && state.score > 0;
    document.getElementById('finalScore').textContent =
        `Score: ${state.score}  ·  Level: ${state.level}  ·  Length: ${state.snake.length}`;
    document.getElementById('newHiScore').classList.toggle('hidden', !isNewHi);
    show('gameOverScreen');
}

function togglePause() {
    if (!state.gameStarted || state.gameOver) return;
    state.paused = !state.paused;
    Sounds.pause();
    if (state.paused) {
        show('pauseScreen');
    } else {
        hide('pauseScreen');
        ensureAudio();
    }
}

function saveGame() {
    const save = {
        snake: state.snake,
        score: state.score,
        level: state.level,
        food: state.food,
        obstacles: state.obstacles,
        inputDir: state.inputDir,
        speed: state.speed,
        hiscore: state.hiscore,
        savedAt: new Date().toISOString(),
    };
    localStorage.setItem('snako_save', JSON.stringify(save));
    flashHud('scoreBox');
    alert('💾 Game saved!');
}

function loadGame() {
    const raw = localStorage.getItem('snako_save');
    if (!raw) { alert('No saved game found!'); return; }
    try {
        const save = JSON.parse(raw);
        state.snake = save.snake;
        state.score = save.score;
        state.level = save.level;
        state.food = save.food || [];
        state.obstacles = save.obstacles || [];
        state.inputDir = save.inputDir;
        state.speed = save.speed;
        state.hiscore = Math.max(state.hiscore, save.hiscore || 0);
        state.gameStarted = true;
        state.gameOver = false;
        state.paused = false;
        state.growthQueue = 0;
        clearAllPowerups();
        hide('startScreen');
        hide('gameOverScreen');
        hide('pauseScreen');
        updateHUD();
    } catch (e) {
        alert('Failed to load saved game.');
    }
}

function setDirection(newDir) {
    const cur = state.inputDir;
    // Reject reverse (only if snake is already moving)
    if (cur.x !== 0 || cur.y !== 0) {
        if (newDir.x === -cur.x && newDir.y === -cur.y) return;
    }
    state.pendingDir = newDir;

    // Start game on first direction input
    if (!state.gameStarted) return;
    ensureAudio();
}

window.addEventListener('keydown', e => {
    ensureAudio();
    switch (e.key) {
        case ' ':
        case 'Spacebar':
            e.preventDefault();
            togglePause();
            break;
        case 'ArrowUp':    e.preventDefault(); setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown':  e.preventDefault(); setDirection({ x: 0, y: 1 });  break;
        case 'ArrowLeft':  e.preventDefault(); setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': e.preventDefault(); setDirection({ x: 1, y: 0 });  break;
        case 'w': case 'W': setDirection({ x: 0, y: -1 }); break;
        case 's': case 'S':
            if (e.ctrlKey) { e.preventDefault(); saveGame(); }
            else setDirection({ x: 0, y: 1 });
            break;
        case 'a': case 'A': setDirection({ x: -1, y: 0 }); break;
        case 'd': case 'D': setDirection({ x: 1, y: 0 }); break;
        case 'l': case 'L': loadGame(); break;
        case 'm': case 'M': toggleSound(); break;
    }
});

// Mobile D-Pad
document.querySelectorAll('.dpad-btn').forEach(btn => {
    const activate = (e) => {
        e.preventDefault();
        ensureAudio();
        const dir = btn.dataset.dir;
        const dirs = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
        setDirection(dirs[dir]);
    };
    btn.addEventListener('touchstart', activate, { passive: false });
    btn.addEventListener('click', activate);
});

document.getElementById('mobilePauseBtn').addEventListener('click', () => {
    ensureAudio();
    togglePause();
});

// Touch swipe controls
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
canvas.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // Ignore tiny taps
    ensureAudio();
    if (absDx > absDy) setDirection(dx > 0 ? {x:1,y:0} : {x:-1,y:0});
    else               setDirection(dy > 0 ? {x:0,y:1} : {x:0,y:-1});
    touchStart = null;
}, { passive: true });


document.getElementById('startBtn').addEventListener('click', () => { ensureAudio(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { ensureAudio(); startGame(); });
document.getElementById('saveBtn').addEventListener('click', saveGame);
document.getElementById('saveGameBtn').addEventListener('click', saveGame);
document.getElementById('loadGameBtn').addEventListener('click', () => { loadGame(); hide('pauseScreen'); });

// Sound Toggle
function toggleSound() {
    state.soundOn = !state.soundOn;
    document.getElementById('soundToggle').textContent = state.soundOn ? '🔊' : '🔇';
}
document.getElementById('soundToggle').addEventListener('click', () => { ensureAudio(); toggleSound(); });

// Theme Switcher
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.theme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', state.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('snako_theme', state.theme);
    });
});


function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }


(function init() {
    // Load hi-score
    state.hiscore = parseInt(localStorage.getItem('snako_hiscore') || '0', 10);
    updateHUD();

    // Load saved theme
    const savedTheme = localStorage.getItem('snako_theme');
    if (savedTheme && THEMES[savedTheme]) {
        state.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.querySelectorAll('.theme-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === savedTheme);
        });
    }

    // Draw initial board
    drawBoard();

    // Start animation loop
    window.requestAnimationFrame(gameEngine);
})();