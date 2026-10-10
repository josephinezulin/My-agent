// Level generator for Count and Bounce.
// Builds each board from a seeded recipe, then simulates pouring every ball
// from several fixed aim points. The level target is a share of the best
// result, so every level is beatable with a steady hand.
// Usage: node tools/generate-bounce.js > site/bounce/levels.js

const B = require('../site/bounce/engine.js');
const { W } = B;
const COUNT = 30;

function build(index, seed) {
  const r = B.rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const tier = Math.floor(index / 6); // 0..4
  const level = { seed, balls: 10 + tier * 2, gates: [], pegs: [], walls: [], spikes: [] };

  const rows = 3 + Math.min(2, tier);
  const top = 150, bottom = 590;
  const gap = (bottom - top) / rows;
  const ops = [['x', 2], ['x', 2], ['x', 3], ['+', 5], ['+', 10], ['x', 4], ['+', 3]];
  for (let k = 0; k < rows; k++) {
    const y = top + k * gap;
    const kind = k === 0 ? 'gates' : pick(['gates', 'gates', 'pegs', tier >= 1 ? 'spikes' : 'pegs', tier >= 2 ? 'mixed' : 'gates']);
    if (kind === 'gates' || kind === 'mixed') {
      const n = pick([1, 2, 2, 3]);
      const w = Math.min(150, (W - 40) / n - 10);
      for (let i = 0; i < n; i++) {
        const [op, val] = pick(ops);
        const x = 20 + i * ((W - 40) / n) + r() * ((W - 40) / n - w);
        const moving = tier >= 1 && r() < 0.25 + tier * 0.1;
        const range = moving ? Math.min(x - 5, W - x - w - 5, 40 + r() * 50) : 0;
        level.gates.push({ x, y, w, h: 18, op, n: val, range: Math.max(0, range), speed: 0.8 + r() * 1.2 });
      }
      if (kind === 'mixed') level.spikes.push({ x: 20 + r() * (W - 120), y: y + 34, w: 60 + r() * 40, h: 10 });
    } else if (kind === 'pegs') {
      const n = 5 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) level.pegs.push({ x: 30 + (i + (k % 2) * 0.5) * ((W - 60) / n), y: y + 10, r: 7 });
    } else {
      // Spike bar with one or two openings.
      const holes = pick([1, 2]);
      let x = 0;
      const width = 70 + r() * 30 - tier * 6;
      const holeAt = [];
      for (let h = 0; h < holes; h++) holeAt.push(40 + r() * (W - 80 - width));
      holeAt.sort((a, b) => a - b);
      for (const hx of holeAt) {
        if (hx > x) level.spikes.push({ x, y: y + 10, w: hx - x, h: 10 });
        x = Math.max(x, hx + width);
      }
      if (x < W) level.spikes.push({ x, y: y + 10, w: W - x, h: 10 });
    }
  }

  // Shelves that funnel balls on later levels.
  if (tier >= 2) {
    const n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) level.walls.push({ x: 10 + r() * (W - 110), y: top + gap * (0.5 + Math.floor(r() * rows)), w: 70 + r() * 30, h: 8 });
  }

  const cupW = Math.max(70, 140 - index * 2.5);
  const moving = index >= 6;
  const range = moving ? Math.min(60 + tier * 25, (W - cupW) / 2 - 5) : 0;
  level.cup = { x: (W - cupW) / 2 + (moving ? 0 : (r() - 0.5) * (W - cupW - 20)), y: 630, w: cupW, h: 70, range, speed: moving ? 0.6 + r() * 0.6 + tier * 0.15 : 0 };
  return level;
}

function simulate(level, aim) {
  const w = B.createWorld(level);
  for (let i = 0; i < 30 / B.DT && !B.finished(w); i++) B.step(w, { x: aim, pouring: true });
  return w.collected;
}

const levels = [];
for (let i = 0; i < COUNT; i++) {
  for (let seed = 1000 + i * 97; ; seed++) {
    const level = build(i, seed);
    let best = 0, bestAim = 0;
    for (let aim = 20; aim <= W - 20; aim += 30) {
      const got = simulate(level, aim);
      if (got > best) { best = got; bestAim = aim; }
    }
    // Reject boards that are dull (little multiplying) or nearly impossible.
    if (best < level.balls * 3 || best > 450) continue;
    level.target = Math.max(level.balls, Math.round(best * (0.62 - Math.min(0.12, i * 0.004))));
    level.best = best;
    levels.push(level);
    process.stderr.write(`level ${i + 1}: balls=${level.balls} best=${best}@${bestAim} target=${level.target}\n`);
    break;
  }
}
process.stdout.write('window.BOUNCE_LEVELS = ' + JSON.stringify(levels, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)) + ';\n');
