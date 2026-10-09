// Level generator for Block Out.
// Places random polyomino blocks on a grid, adds a colored gate per color,
// and keeps only boards that a BFS solver can clear completely.
// Usage: node tools/generate-levels.js > site/levels.js

const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
];

const COLORS = 8;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function span(shape) {
  let w = 0, h = 0;
  for (const [x, y] of shape) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); }
  return { w, h };
}

// A block of size (w,h) at (x,y) can leave through gate g when it touches the
// gate's side and its extent along that side lies inside the gate.
function canExit(b, x, y, g, W, H) {
  if (g.color !== b.color) return false;
  const { w, h } = span(b.shape);
  if (g.side === 'L') return x === 0 && y >= g.from && y + h <= g.to;
  if (g.side === 'R') return x + w === W && y >= g.from && y + h <= g.to;
  if (g.side === 'T') return y === 0 && x >= g.from && x + w <= g.to;
  return y + h === H && x >= g.from && x + w <= g.to;
}

// Greedy solver: repeatedly flood-fill each remaining block's reachable positions
// (others fixed) and remove every block that can reach its gate. Removing a block
// never hurts, so success proves the board is clearable. Returns the number of
// removal rounds (a difficulty measure) or -1 when it gets stuck.
function solve(level) {
  const { w: W, h: H, blocks, gates } = level;
  const alive = blocks.map(() => true);
  const pos = blocks.map(b => [b.x, b.y]);

  function reachesGate(i) {
    const grid = new Int8Array(W * H).fill(-1);
    blocks.forEach((b, j) => {
      if (!alive[j] || j === i) return;
      for (const [cx, cy] of b.shape) grid[(pos[j][1] + cy) * W + pos[j][0] + cx] = j;
    });
    const seen = new Set([pos[i].join(',')]);
    const queue = [pos[i]];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (gates.some(g => canExit(blocks[i], x, y, g, W, H))) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        const ok = blocks[i].shape.every(([cx, cy]) => {
          const px = nx + cx, py = ny + cy;
          return px >= 0 && py >= 0 && px < W && py < H && grid[py * W + px] === -1;
        });
        if (!ok) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    return false;
  }

  let rounds = 0;
  while (alive.some(Boolean)) {
    const free = blocks.map((_, i) => alive[i] && reachesGate(i));
    if (!free.some(Boolean)) return -1;
    free.forEach((f, i) => { if (f) alive[i] = false; });
    rounds++;
  }
  return rounds;
}

function tryLevel(rand, W, H, count, colorCount) {
  const grid = new Int8Array(W * H).fill(-1);
  const blocks = [];
  let attempts = 0;
  while (blocks.length < count && attempts++ < 500) {
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
    const { w, h } = span(shape);
    const x = Math.floor(rand() * (W - w + 1));
    const y = Math.floor(rand() * (H - h + 1));
    if (shape.some(([cx, cy]) => grid[(y + cy) * W + x + cx] !== -1)) continue;
    const color = blocks.length < colorCount ? blocks.length : Math.floor(rand() * colorCount);
    shape.forEach(([cx, cy]) => (grid[(y + cy) * W + x + cx] = blocks.length));
    blocks.push({ shape, x, y, color });
  }
  if (blocks.length < count) return null;

  // One gate per color, sized to fit the widest block of that color.
  const gates = [];
  const used = { L: [], R: [], T: [], B: [] };
  for (let c = 0; c < colorCount; c++) {
    const mine = blocks.filter(b => b.color === c);
    if (!mine.length) continue;
    const sides = ['L', 'R', 'T', 'B'].sort(() => rand() - 0.5);
    let placed = false;
    for (const side of sides) {
      const vertical = side === 'L' || side === 'R';
      const need = Math.max(...mine.map(b => (vertical ? span(b.shape).h : span(b.shape).w)));
      const len = Math.min(need + (rand() < 0.3 ? 1 : 0), vertical ? H : W);
      const max = (vertical ? H : W) - len;
      const from = Math.floor(rand() * (max + 1));
      const to = from + len;
      if (used[side].some(([a, b]) => from < b && a < to)) continue;
      used[side].push([from, to]);
      gates.push({ side, from, to, color: c });
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  return { w: W, h: H, blocks, gates };
}

// Difficulty curve: board size, block count and color count per level.
const PLAN = [
  [4, 4, 3, 2], [4, 4, 4, 3], [5, 5, 5, 3], [5, 5, 6, 4], [5, 5, 7, 4],
  [5, 6, 7, 5], [6, 6, 8, 5], [6, 6, 9, 5], [6, 6, 10, 6], [6, 7, 10, 6],
  [6, 7, 11, 6], [7, 7, 11, 7], [7, 7, 12, 7], [7, 7, 13, 7], [7, 8, 13, 8],
  [7, 8, 14, 8], [8, 8, 14, 8], [8, 8, 15, 8], [8, 8, 16, 8], [8, 9, 16, 8],
];

const rand = rng(20261009);
const levels = [];
PLAN.forEach(([W, H, count, colors], idx) => {
  const minRounds = idx < 2 ? 2 : idx < 8 ? 3 : 4;
  for (let tries = 0; tries < 200000; tries++) {
    const lvl = tryLevel(rand, W, H, count, Math.min(colors, COLORS));
    if (!lvl) continue;
    // Skip boards where many blocks leave without any move.
    const freebies = lvl.blocks.filter(b => lvl.gates.some(g => canExit(b, b.x, b.y, g, W, H))).length;
    if (freebies > 0) continue;
    const rounds = solve(lvl);
    if (rounds < minRounds) continue;
    levels.push(lvl);
    process.stderr.write(`level ${idx + 1}: ${W}x${H} blocks=${count} rounds=${rounds} tries=${tries}\n`);
    return;
  }
  throw new Error('could not build level ' + (idx + 1));
});

process.stdout.write('window.LEVELS = ' + JSON.stringify(levels) + ';\n');
